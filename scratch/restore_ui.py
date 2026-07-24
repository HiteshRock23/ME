import json
import re

transcript_path = r"C:\Users\DEll\.gemini\antigravity-ide\brain\eb6a3310-e0a8-466e-88c8-9eda10192b86\.system_generated\logs\transcript_full.jsonl"
output_path = r"c:\Users\DEll\Desktop\Startup\ME\static\js\ui.js"

print("Parsing transcript...")
sections = {}

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            step_index = data.get("step_index", 999)
            # Only use specific steps where ui.js was read
            if step_index not in [9, 13, 15, 17]:
                continue
                
            content = data.get("content", "")
            match = re.search(r"Showing lines (\d+) to (\d+)", content)
            if match:
                start = int(match.group(1))
                end = int(match.group(2))
                print(f"Found code block for lines {start} to {end} at step {step_index}")
                
                for l in content.split("\n"):
                    l_match = re.match(r"^(\d+):\s(.*)", l)
                    if l_match:
                        line_num = int(l_match.group(1))
                        line_content = l_match.group(2)
                        sections[line_num] = line_content
        except Exception as e:
            print("Error processing line:", e)

if sections:
    print(f"Reconstructed {len(sections)} lines of code.")
    max_line = max(sections.keys())
    print(f"Max line number: {max_line}")
    
    with open(output_path, "w", encoding="utf-8") as out:
        for i in range(1, max_line + 1):
            line_code = sections.get(i, "")
            out.write(line_code + "\n")
    print("Successfully restored ui.js!")
else:
    print("No sections found to reconstruct.")
