

# DB-Kompare Backend AWS Serverless

This is a serverless application using the **AWS Serverless Framework** with **Node.js**. Follow the steps below to run the project on your AWS account.

## How to Run the Project

### 1. Clone the Repository
Clone the project to your local machine:
```bash
git clone repo_link
cd aws-serverless-nodejs
```

### 2. Install Dependencies
Install the required Node.js packages for specific stacks. In our Project only api-functions needs node modules.
```bash
npm install
```

### 3. Configure AWS CLI

To interact with AWS, you'll need to configure the **AWS CLI** with your AWS credentials. If you haven't done this already, follow the steps below:

1. **Install AWS CLI**: If you don’t have the AWS CLI installed, follow the instructions [here](https://aws.amazon.com/cli/) to install it.

2. **Configure AWS CLI**: Run the following command to configure your AWS credentials:
   ```bash
   aws configure
   ```

3. **Provide your AWS credentials** when prompted:

   Example:
   ```bash
   AWS Access Key ID [None]: <Your-Access-Key-ID>
   AWS Secret Access Key [None]: <Your-Secret-Access-Key>
   Default region name [None]: Your Region
   Default output format [None]: json
   ```

### 4. Configure Your Project
- Open the `serverless.yml` file.
- Update any configuration variables, such as:
  - **AWS Region**: Ensure the region matches your `aws configure` setup.
  - **Environment Variables**: Add Environment variables file. (.env file is only for api-functions)

### 5. Deploy the Project to AWS
Deploy your serverless application to AWS using the Serverless Framework:
```bash
serverless deploy
```

This will:
- Deploy your Lambda functions.
- Set up API Gateway endpoints.
- Create or update other AWS resources defined in `serverless.yml`.

### 6. Get the API URL
After deployment, you will see a URL for the **API Gateway** in the terminal output. This URL is your endpoint to test the deployed functions.

---

That's it! Your serverless application is now live on AWS.

---
