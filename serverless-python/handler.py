import json
import pandas as pd
from pandas_profiling import ProfileReport

def handler(event, context):
    # Create a sample DataFrame.
    # Replace or modify this with your own data or input parsing from the event.
    data = {
        "Column1": [1, 2, 3, 4, 5],
        "Column2": ["A", "B", "C", "D", "E"],
        "Column3": [10.5, 20.3, 30.2, 40.1, 50.0]
    }
    df = pd.DataFrame(data)
    
    # Generate the profiling report (explorative enables more detailed analysis).
    profile = ProfileReport(df, title="Pandas Profiling Report", explorative=True)
    
    # Convert the report to an HTML string.
    report_html = profile.to_html()
    
    # Build and return the response object.
    response = {
        "statusCode": 200,
        "body": report_html
    }
    return response
