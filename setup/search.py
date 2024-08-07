import csv

# by Assignee
file_path = '../feeds/users.csv'
syntax_terms = []
with open(file_path, newline='') as csvfile:
    reader = csv.reader(csvfile)
    counter = 0
    for row in reader:
        syntax_terms.append(f'"assignee: {"_".join(row[1].split(" "))}"')
        counter += 1
        if counter >= 20:
            break

# by keywords in summary
file_path = '../feeds/summaries.csv'
text_terms = []
with open(file_path, newline='') as csvfile:
    reader = csv.reader(csvfile)
    counter = 0
    for row in reader:
        words = row[0].split(" ")
        for word in words:
            text_terms.append(word)
        counter += 1
        if counter >= 20:
            break
text_terms = set(text_terms)

for word in text_terms:
    print(word)
