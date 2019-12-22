
import ast
import csv
import os
import tempfile
import tarfile
import urllib.request
import sys

from google.cloud import firestore


url = 'https://github.com/AbhiOnlyOne/us-car-models-data/archive/master.tar.gz'
directory = './master.tar/us-car-models-data-master'

ct = 0
total = 0
db = firestore.Client()
batch = db.batch()

with tempfile.TemporaryDirectory() as tempdir:
    os.chdir(tempdir)
    file_tmp = urllib.request.urlretrieve(url, filename=None)[0]
    base_name = os.path.basename(url)
    file_name, file_extension = os.path.splitext(base_name)
    tar = tarfile.open(file_tmp)
    tar.extractall(file_name)
    tar.close()

    for filename in os.listdir(directory):
        if not filename.endswith(".csv"):
            continue
        with open(os.path.join(directory, filename), newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # print(row)
                document_key = "{}_{}_{}".format(row["make"], row["model"], row["year"]).replace("/", "_")
                row['year'] = int(row['year'])
                row['body_styles'] = ast.literal_eval(row['body_styles'])
                row['id'] = document_key
                batch.set(db.collection("Car").document(document_key), (row))
                if ct > 349:
                    print("writing ", ct, " documents")
                    batch.commit()
                    total += ct
                    ct = 0
                    batch = db.batch()
                    continue
                ct += 1
if ct > 0:
    print("writing", ct, "documents")
    batch.commit()
    total += ct
print("Wrote total of", total, "documents")


sys.exit()
