# Use a minimal Python image
FROM python:3.8-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy your script and any other code
COPY script.py ./

# ENTRYPOINT runs your script automatically:
#   python script.py <bucket> <full-s3-key>
ENTRYPOINT ["python", "script.py"]

# No default CMD: AWS Batch will append the two args
CMD []
