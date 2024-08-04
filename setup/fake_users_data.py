from faker import Faker
import csv


fake = Faker()

users_count = 100
# no duplicates
users = {fake.name() for _ in range(users_count)}

with open('../feeds/users.csv', 'w') as csvfile:
    fieldnames = ['email','name']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    for user in users:
        email = f'{user.replace(" ","").lower()}@example.com'
        writer.writerow({'email': email, 'name': user})
