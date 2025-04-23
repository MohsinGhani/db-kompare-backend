import os
import json
import pandas as pd
from ydata_profiling import ProfileReport

# suppress ydata banner
os.environ["YDATA_SUPPRESS_BANNER"] = "1"

def generate_report(df: pd.DataFrame) -> str:
    profile = ProfileReport(
        df,
        title="Profiling Report",
        explorative=False,
        minimal=True,
        pool_size=4,  # Set to 1 to avoid parallel processing in Lambda
        correlations=None,
        missing_diagrams=None,
        duplicates=None,
        interactions=None,
        sample=None,
        config=None,
    )
    return profile.to_html()

def handler(event, context):
    # 1. Extract the payload: could be API GW proxy or direct Lambda invoke
    # If behind API Gateway HTTP API, body is a string
    body = event.get("body", event)
    if isinstance(body, str):
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON in request body")
    else:
        payload = body

    # 2. Ensure payload is a list of objects
    if not isinstance(payload, list):
        raise ValueError("Expected an array of objects")

    # 3. Convert to DataFrame
    df = pd.DataFrame(payload)

    # 4. Generate the profiling HTML
    html_report = generate_report(df)

    # 5. Return as HTML
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "text/html"},
        "body": html_report
    }
