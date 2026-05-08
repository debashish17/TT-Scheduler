import json
d = json.load(open("tests/fixtures/solved_school_run.json"))
print(f"subjects={len(d['subjects'])} teachers={len(d['teachers'])} "
      f"classes={len(d['classes'])} rooms={len(d['rooms'])}")
print(f"days={len(d['working_days'])} ppd={d['periods_per_day']}")
n = 0
for s in d["subjects"]:
    tc = s.get("target_classes") or d["classes"]
    n += int(s["periods_per_week"]) * len(tc)
print(f"expected sessions ~{n}")
