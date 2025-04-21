# generate_report.py
import os
import pandas as pd
from ydata_profiling import ProfileReport

# 1. turn off that banner
os.environ["YDATA_SUPPRESS_BANNER"] = "1"

def generate_report():
    # 2. dummy data
    df = pd.DataFrame({
        "user_id":   [101, 102, 103, 104],
        "age":       [25, 32, 47, 51],
        "signup_date": pd.to_datetime([
            "2024-01-15", "2024-02-20", "2024-03-10", "2024-04-05"
        ]),
        "is_active": [True, False, True, True],
        "score":     [88.5, 92.3, 70.1, 65.4]
    })

    # 3. profile it
    profile = ProfileReport(
        df,
        title="Dummy YData Profiling Report",
        explorative=True
    )
    return profile.to_html()

if __name__ == "__main__":
    html = generate_report()

    # 4. save to disk
    with open("profile_report.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ Written report to profile_report.html")

    # 5. show a snippet of the output
    snippet = html[:200].replace("\n", "")
    print("\n--- HTML snippet: ---\n", snippet, "\n...")    
