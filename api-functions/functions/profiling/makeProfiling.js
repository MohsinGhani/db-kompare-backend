import AWS from "aws-sdk";

// AWS Batch client (v2 SDK)
const batch = new AWS.Batch();

// Environment variables to configure
const JOB_QUEUE = process.env.JOB_QUEUE; // e.g. "my-batch-queue"
const JOB_DEFINITION = process.env.JOB_DEFINITION; // e.g. "my-profile-jobdef:1"
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "reports/";
const DDB_TABLE = process.env.DDB_TABLE; // DynamoDB table name to update

export const handler = async (event) => {
  console.log("Received S3 event:", JSON.stringify(event, null, 2));

  try {
    const submissions = event.Records.map(async (record) => {
      const bucket = record.s3.bucket.name;
      const rawKey = record.s3.object.key;
      const key = decodeURIComponent(rawKey.replace(/\+/g, " "));

      // Parse userId and projectId from key path
      // e.g. key = 'input/user123/proj456/uuid.json'
      const [, userId, projectId, fileName] = key.split("/");
      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const timestamp = Date.now();

      // Construct unique job and output names
      const jobName = `profile-job-${userId}-${projectId}-${baseName}-${timestamp}`;
      const outputKey = `${OUTPUT_PREFIX}${userId}/${projectId}/${baseName}-${timestamp}.html`;

      // Prepare Batch submission parameters with extra env vars
      const params = {
        jobName,
        jobQueue: JOB_QUEUE,
        jobDefinition: JOB_DEFINITION,
        containerOverrides: {
          environment: [
            { name: "BUCKET", value: bucket },
            { name: "INPUT_S3_KEY", value: key },
            { name: "OUTPUT_S3_KEY", value: outputKey },
            { name: "USER_ID", value: userId },
            { name: "PROJECT_ID", value: projectId },
            { name: "DDB_TABLE", value: DDB_TABLE },
          ],
        },
      };

      // Submit the AWS Batch job
      const resp = await batch.submitJob(params).promise();
      console.log(`Submitted Batch job ${resp.jobId} for input ${key}`);
    });

    await Promise.all(submissions);
    console.log("All Batch jobs submitted successfully.");
  } catch (error) {
    console.error("Error submitting Batch jobs:", error);
    throw error;
  }
};
