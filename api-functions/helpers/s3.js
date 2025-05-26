// src/helpers/s3.js

import S3 from "aws-sdk/clients/s3.js";

const S3Client = new S3({ region: process.env.BUCKET_REGION || "eu-west-1" });

export function getBucketName(bucketKeyOrName) {
  // if bucketKeyOrName matches an env var, return that; otherwise assume it’s already a bucket name
  return process.env[bucketKeyOrName] || bucketKeyOrName;
}

/**
 * Get the raw S3 Object (including Body, Metadata, etc.)
 */
export const getObjectFromS3 = (bucket, key) => {
  const params = {
    Bucket: getBucketName(bucket),
    Key: key,
  };
  return S3Client.getObject(params).promise();
};

/**
 * Fetch just the Buffer contents of an S3 object
 */
export const fetchBufferFromS3 = async (bucket, key) => {
  const data = await getObjectFromS3(bucket, key);
  return data.Body; // Buffer
};

/**
 * Upload a Buffer (or stream/string) to S3
 */
export const uploadBufferToS3 = (
  bucket,
  key,
  buffer,
  acl = "private",
  contentType = "application/octet-stream"
  
) => {
  const params = {
    Bucket: getBucketName(bucket),
    Key: key,
    Body: buffer,
    ACL: acl,
    ContentType: contentType,
  };
  return S3Client.putObject(params).promise();
};

/**
 * Delete an object from S3
 */
export const deleteObjectFromS3 = (bucket, key) => {
  const params = {
    Bucket: getBucketName(bucket),
    Key: key,
  };
  return S3Client.deleteObject(params).promise();
};

/**
 * List objects under a given prefix
 */
export const listObjectsInS3 = (
  bucket,
  prefix = "",
  maxKeys
) => {
  const params = {
    Bucket: getBucketName(bucket),
    Prefix: prefix,
  };
  if (typeof maxKeys === "number") {
    params.MaxKeys = maxKeys;
  }
  return S3Client.listObjectsV2(params).promise();
};
