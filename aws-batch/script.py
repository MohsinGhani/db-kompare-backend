import boto3
import csv
import sys
from io import StringIO

def main(bucket, key):
  s3_client = boto3.client('s3',region_name='eu-west-1')
  dynamodb_client = boto3.resource('dynamodb',region_name='eu-west-1')

  # Read the CSV file from S3
  file_obj = s3_client.get_object(Bucket=bucket, Key=key)
  csv_content = file_obj['Body'].read().decode('utf-8')

  # Define the DynamoDB table
  table = dynamodb_client.Table('batch-test')

  # Read the CSV content
  csv_reader = csv.DictReader(StringIO(csv_content))

  # Iterate through the CSV and write to DynamoDB
  for row in csv_reader:
    Id = int(row['Id'])
    SEPAL_LENGTH = row['SEPAL_LENGTH']
    SEPAL_WIDTH = (row['SEPAL_WIDTH'])
    PETAL_LENGTH = row['PETAL_LENGTH']
    PETAL_WIDTH = row['PETAL_WIDTH']
    CLASS_NAME = row['CLASS_NAME']

    # Write to DynamoDB
    table.put_item(
    Item={
    'Id':Id,
    'SEPAL_LENGTH': SEPAL_LENGTH,
    'SEPAL_WIDTH': SEPAL_WIDTH,
    'PETAL_LENGTH': PETAL_LENGTH,
    'PETAL_WIDTH': PETAL_WIDTH,
    'CLASS_NAME':CLASS_NAME
    }
    )

  print('CSV processed successfully!')

if __name__ == "__main__":
    # Extract command-line arguments
    if len(sys.argv) != 3:
        print("Usage: python script.py <S3_BUCKET_NAME> <S3_KEY>")
        sys.exit(1)

    s3_bucket = sys.argv[1]
    s3_key = sys.argv[2]

    # Execute the main function with provided arguments
    main(s3_bucket, s3_key)