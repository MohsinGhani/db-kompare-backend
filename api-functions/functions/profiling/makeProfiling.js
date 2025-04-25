import AWS from "aws-sdk";

const batch = new AWS.Batch();

const JOB_QUEUE = process.env.JOB_QUEUE;
const JOB_DEFINITION = process.env.JOB_DEFINITION;

export const handler = async (event) => {
  console.log("Received S3 event:", JSON.stringify(event, null, 2));

  try {
    // Process each record in parallel
    await Promise.all(
      event.Records.map(async (record) => {
        const bucket = record.s3.bucket.name;
        const rawKey = record.s3.object.key;
        const key = decodeURIComponent(rawKey.replace(/\+/g, " "));

        // Ensure the key starts with 'INPUT/' (case-insensitive)
        const parts = key.split("/");
        if (parts[0].toLowerCase() !== "input") {
          console.log(`Skipping key ${key}: not under 'INPUT/'`);
          return;
        }

        // Extract userId, projectId, and fileName from the key
        const [, userId, projectId, id] = parts;
        const timestamp = Date.now();
        // Build unique jobName and outputKey
        const jobName = `profile-job-${timestamp}`;

        // Submit the AWS Batch job
        const params = {
          jobName,
          jobQueue: JOB_QUEUE,
          jobDefinition: JOB_DEFINITION,
          containerOverrides: { command: [bucket, key] },
          retryStrategy: { attempts: 1 },
        };

        const resp = await batch.submitJob(params).promise();
        console.log(`Submitted AWS Batch job ${resp.jobId} for input ${key}`);
      })
    );

    console.log("All Batch jobs submitted successfully.");
  } catch (error) {
    console.error("Error submitting Batch jobs:", error);
    throw error;
  }
};
