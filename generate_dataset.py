import json
import random
import uuid

def generate_dataset():
    dataset = []
    
    # Vocabulary for randomization
    array_names = ['data', 'collection', 'items', 'numbers', 'values', 'source', 'arr', 'list_vals']
    var_names = ['x', 'y', 'target', 'val', 'count', 'limit', 'threshold', 'maximum', 'minimum', 'tracker', 'result']
    operations = ['+', '*', '-', '/']
    
    # We will generate 10,000 items
    TOTAL_ITEMS = 10000
    
    # 5 procedural templates that match the PseudocodeCompiler's rigid syntax
    
    # Template 1: Linear search threshold
    def gen_template_1(idx):
        arr = random.choice(array_names)
        t = random.randint(10, 100)
        limit = random.randint(3, 8)
        arr_vals = [random.randint(1, 150) for _ in range(limit + 1)]
        
        pseudo = f"""BEGIN
  DECLARE {arr} AS ARRAY
  {arr} = {arr_vals}
  DECLARE threshold AS INTEGER
  threshold = {t}
  DECLARE count AS INTEGER
  count = 0
  DECLARE i AS INTEGER
  FOR i FROM 0 TO {limit} DO
    IF {arr}[i] > threshold THEN
      count = count + 1
    ENDIF
  ENDFOR
  PRINT count
END"""
        
        python = f"""{arr} = {arr_vals}
threshold = {t}
count = 0
for i in range(0, {limit} + 1):
    if {arr}[i] > threshold:
        count = count + 1
print(count)"""
        
        return {
            "id": f"algo_{idx}",
            "concept": "Array Filtering (Count)",
            "description": f"Counts the number of elements in an array that are strictly greater than {t}.",
            "pseudocode": pseudo,
            "python_code": python,
            "difficulty": "easy"
        }

    # Template 2: Basic While Loop Aggregation
    def gen_template_2(idx):
        max_val = random.randint(20, 100)
        v = random.choice(var_names)
        
        pseudo = f"""BEGIN
  DECLARE {v} AS INTEGER
  {v} = 0
  DECLARE i AS INTEGER
  i = 1
  WHILE i < {max_val} DO
    {v} = {v} + i
    i = i + 2
  ENDWHILE
  PRINT {v}
END"""
        
        python = f"""{v} = 0
i = 1
while i < {max_val}:
    {v} = {v} + i
    i = i + 2
print({v})"""

        return {
            "id": f"algo_{idx}",
            "concept": "While Loop Mathematical Series",
            "description": f"Calculates the sum of odd numbers strictly less than {max_val}.",
            "pseudocode": pseudo,
            "python_code": python,
            "difficulty": "medium"
        }

    # Template 3: Array Transformation
    def gen_template_3(idx):
        arr = random.choice(array_names)
        limit = random.randint(3, 7)
        arr_vals = [random.randint(1, 20) for _ in range(limit + 1)]
        mult = random.randint(2, 5)
        
        pseudo = f"""BEGIN
  DECLARE {arr} AS ARRAY
  {arr} = {arr_vals}
  DECLARE i AS INTEGER
  FOR i FROM 0 TO {limit} DO
    {arr}[i] = {arr}[i] * {mult}
  ENDFOR
  PRINT {arr}
END"""
        
        python = f"""{arr} = {arr_vals}
for i in range(0, {limit} + 1):
    {arr}[i] = {arr}[i] * {mult}
print({arr})"""

        return {
            "id": f"algo_{idx}",
            "concept": "In-Place Array Transformation",
            "description": f"Multiplies every element in the array iteratively by {mult}.",
            "pseudocode": pseudo,
            "python_code": python,
            "difficulty": "easy"
        }
        
    # Template 4: Dual Condition Loop
    def gen_template_4(idx):
        limit = random.randint(10, 50)
        m1 = random.randint(2, 4)
        m2 = random.randint(5, 7)
        
        pseudo = f"""BEGIN
  DECLARE count AS INTEGER
  count = 0
  DECLARE i AS INTEGER
  FOR i FROM 1 TO {limit} DO
    IF i MOD {m1} == 0 THEN
      count = count + 1
    ELSE IF i MOD {m2} == 0 THEN
      count = count + 2
    ELSE
      count = count - 1
    ENDIF
  ENDFOR
  PRINT count
END"""
        
        python = f"""count = 0
for i in range(1, {limit} + 1):
    if i % {m1} == 0:
        count = count + 1
    elif i % {m2} == 0:
        count = count + 2
    else:
        count = count - 1
print(count)"""

        return {
            "id": f"algo_{idx}",
            "concept": "Modulo Branching Logic",
            "description": f"Iterates to {limit}, identifying multiples of {m1} and {m2}.",
            "pseudocode": pseudo,
            "python_code": python,
            "difficulty": "medium"
        }
        
    # Template 5: Accumulating Factorial Variant
    def gen_template_5(idx):
        cap = random.randint(4, 9)
        
        pseudo = f"""BEGIN
  DECLARE limit AS INTEGER
  limit = {cap}
  DECLARE factorial AS INTEGER
  factorial = 1
  DECLARE i AS INTEGER
  FOR i FROM 1 TO limit DO
    factorial = factorial * i
  ENDFOR
  PRINT factorial
END"""

        python = f"""limit = {cap}
factorial = 1
for i in range(1, limit + 1):
    factorial = factorial * i
print(factorial)"""

        return {
            "id": f"algo_{idx}",
            "concept": "Factorial Computation",
            "description": f"Computes the factorial value iteratively up to {cap}.",
            "pseudocode": pseudo,
            "python_code": python,
            "difficulty": "hard"
        }

    templates = [gen_template_1, gen_template_2, gen_template_3, gen_template_4, gen_template_5]
    
    print(f"Generating {TOTAL_ITEMS} records...")
    for i in range(1, TOTAL_ITEMS + 1):
        # Choose a random template
        t_func = random.choice(templates)
        record = t_func(i)
        dataset.append(record)

    with open('dataset.json', 'w') as f:
        json.dump(dataset, f, indent=2)
        
    print("Done! Generated dataset.json")

if __name__ == '__main__':
    generate_dataset()
