from faker import Faker
import csv

fake = Faker()

def generate_summary():
    # Generating an issue summary
    summary = fake.sentence(nb_words=10)
    return summary.strip('.')

def generate_description():
    # Generating an issue description
    description = fake.text(max_nb_chars=200)
    return description.replace('\n', ' ')

def save_to_csv(items, filename='summaries.csv'):
    # Write summaries to a CSV file
    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        for item in items:
            writer.writerow([item])

# Generate a specific number of issues
number_of_issues = 10000
summaries = [generate_summary() for _ in range(number_of_issues)]
descriptions = [generate_description() for _ in range(number_of_issues)]

save_to_csv(summaries, filename='summaries.csv')
save_to_csv(descriptions, filename='descriptions.csv')
