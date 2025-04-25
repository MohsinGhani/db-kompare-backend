import os
import uuid
import sys
import json
import time
import boto3
import pandas as pd
from ydata_profiling import ProfileReport

# AWS clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Configuration via environment variables
TABLE_NAME    = os.environ.get('DDB_TABLE', 'db-kompare-profiling-dev')
INPUT_PREFIX  = os.environ.get('INPUT_PREFIX', 'INPUT/')
OUTPUT_PREFIX = os.environ.get('OUTPUT_PREFIX', 'REPORTS/')


def handler(event, context):
    """
    Lambda handler triggered by S3 ObjectCreated events under '{INPUT_PREFIX}'.
    For each uploaded JSON file, creates a DynamoDB item (status=PENDING),
    runs ydata-profiling on the JSON array, uploads HTML report to S3,
    and updates status to SUCCESS or FAILED.
    """
    table = dynamodb.Table(TABLE_NAME)

    for record in event.get('Records', []):
        bucket = record['s3']['bucket']['name']
        key    = record['s3']['object']['key']

        # Only process keys under INPUT_PREFIX
        if not key.startswith(INPUT_PREFIX):
            print(f"Skipping non-input key: {key}")
            continue

        # Parse userId, fiddleId, and input filename
        parts = key.split('/')
        # Expect: INPUT/{userId}/{fiddleId}/{filename}.json
        if len(parts) < 4:
            print(f"Invalid key format, expected at least 4 segments: {key}")
            continue

        _, user_id, fiddle_id, filename = parts
        base_name = filename.rsplit('.', 1)[0]

        # Unique profile record
        profile_id = str(uuid.uuid4())
        now_ms = int(time.time() * 1000)

        # Compute output report key
        output_key = f"{OUTPUT_PREFIX}{user_id}/{fiddle_id}/{base_name}-{now_ms}.html"

        # Insert initial DynamoDB record with status PENDING
        table.put_item(Item={
            'id':           profile_id,
            'userId':       user_id,
            'fiddleId':     fiddle_id,
            'inputS3Key':   key,
            'outputS3Key':  output_key,
            'status':       'PENDING',
            'createdAt':    now_ms
        })

        try:
            # Fetch JSON file from S3
            obj = s3.get_object(Bucket=bucket, Key=key)
            body = obj['Body'].read().decode('utf-8')
            data = json.loads(body)

            # Load into DataFrame
            df = pd.DataFrame(data)

            # Generate profile report (explorative mode)
            profile = ProfileReport(df, title='Profiling Report', explorative=True)
            html_bytes = profile.to_html().encode('utf-8')

            # Upload HTML report to S3
            s3.put_object(
                Bucket=bucket,
                Key=output_key,
                Body=html_bytes,
                ContentType='text/html'
            )

            # Update DynamoDB to SUCCESS
            completed_ms = int(time.time() * 1000)
            table.update_item(
                Key={'id': profile_id},
                UpdateExpression='SET #s = :status, completedAt = :c',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':status': 'SUCCESS', ':c': completed_ms}
            )

        except Exception as e:
            # On error, update status to FAILED with error message
            error_ms = int(time.time() * 1000)
            table.update_item(
                Key={'id': profile_id},
                UpdateExpression='SET #s = :status, errorMessage = :err, completedAt = :c',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':status': 'FAILED',
                    ':err':    str(e),
                    ':c':      error_ms
                }
            )
            print(f"Profiling failed for {key}: {e}")
            # Optionally re-raise to signal failure
            raise

    return {
        'statusCode': 200,
        'body':       json.dumps({'message': 'Processing complete.'})
    }

if __name__ == "__main__":
    bucket = sys.argv[1]
    key    = sys.argv[2]
    # Build a minimal S3 event for your handler:
    event = {"Records":[{"s3":{"bucket":{"name":bucket},"object":{"key":key}}}]}
    handler(event, None)