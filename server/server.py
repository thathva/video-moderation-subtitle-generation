from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import time
import boto3
app = Flask(__name__)
CORS(app)
from io import BytesIO

AWS_ACCESS_KEY_ID = ''
AWS_SECRET_ACCESS_KEY = ''

@app.route('/upload', methods=['POST'])
def upload():
    s3 = boto3.client('s3',region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    rekognition = boto3.client('rekognition', region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    unsafe_categories = {
        'Explicit Nudity': ['Nudity', 'Graphic Male Nudity', 'Graphic Female Nudity', 'Sexual Activity', 'Illustrated Explicit Nudity', 'Adult Toys'],
        'Suggestive': ['Female Swimwear Or Underwear', 'Male Swimwear Or Underwear'],
        'Partial Nudity': ['Barechested Male'],
        'Revealing Clothes': ['Sexual Situations'],
        'Violence': ['Graphic Violence Or Gore', 'Physical Violence', 'Weapon Violence', 'Weapons', 'Self Injury'],
        'Visually Disturbing': ['Emaciated Bodies', 'Corpses', 'Hanging', 'Air Crash', 'Explosions And Blasts'],
        'Rude Gestures': ['Middle Finger'],
        'Drugs': ['Drug Products', 'Drug Use', 'Pills', 'Drug Paraphernalia'],
        'Tobacco': ['Tobacco Products', 'Smoking'],
        'Alcohol': ['Drinking', 'Alcoholic Beverages'],
        'Gambling': ['Gambling'],
        'Hate Symbols': ['Nazi Party', 'White Supremacy', 'Extremist']
    }
    file = request.files['file']

    # Get the filename and file extension
    filename = file.filename
    file_extension = filename.rsplit('.', 1)[1].lower()

    # Define the S3 key
    timestr = time.strftime("%Y%m%d-%H%M%S")
    s3_key = f'{timestr}'

    # Set the S3 bucket name
    bucket_name = 'sp23-cloud-computing-project'


    s3_url = f'https://{bucket_name}.s3.amazonaws.com/{s3_key}'
    # Upload the file to S3
    s3.upload_fileobj(
        file,
        bucket_name,
        s3_key,
        ExtraArgs={
            'ContentType': f'video/{file_extension}',
        }
    )

    return s3_url

@app.route('/content_moderation', methods=['POST'])
def content_moderation():
    s3 = boto3.client('s3',region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    rekognition = boto3.client('rekognition', region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    unsafe_categories = {
        'Explicit Nudity': ['Nudity', 'Graphic Male Nudity', 'Graphic Female Nudity', 'Sexual Activity', 'Illustrated Explicit Nudity', 'Adult Toys'],
        'Suggestive': ['Female Swimwear Or Underwear', 'Male Swimwear Or Underwear'],
        'Partial Nudity': ['Barechested Male'],
        'Revealing Clothes': ['Sexual Situations'],
        'Violence': ['Graphic Violence Or Gore', 'Physical Violence', 'Weapon Violence', 'Weapons', 'Self Injury'],
        'Visually Disturbing': ['Emaciated Bodies', 'Corpses', 'Hanging', 'Air Crash', 'Explosions And Blasts'],
        'Rude Gestures': ['Middle Finger'],
        'Drugs': ['Drug Products', 'Drug Use', 'Pills', 'Drug Paraphernalia'],
        'Tobacco': ['Tobacco Products', 'Smoking'],
        'Alcohol': ['Drinking', 'Alcoholic Beverages'],
        'Gambling': ['Gambling'],
        'Hate Symbols': ['Nazi Party', 'White Supremacy', 'Extremist']
    }
    bucket_name = 'sp23-cloud-computing-project'
    data = request.get_json()['url']['data']
    s3_key = data.split("/")[-1]
    # Perform content moderation using AWS Rekognition
    response = rekognition.start_content_moderation(
        Video={
            'S3Object': {
                'Bucket': bucket_name,
                'Name': s3_key
            }
        },
        MinConfidence=50
    )
   # moderation_labels = response['ModerationLabels']
    job_id = response['JobId']

    # Wait for content moderation job to complete
    while True:
        status = rekognition.get_content_moderation(JobId=job_id)['JobStatus']
        if status in ['SUCCEEDED', 'FAILED']:
            break
        time.sleep(5)

    if status == 'SUCCEEDED':
        moderation_labels = rekognition.get_content_moderation(JobId=job_id)['ModerationLabels']
        unsafe = any(label['ModerationLabel']['ParentName'] in unsafe_categories and label['ModerationLabel']['Name'] in unsafe_categories[label['ModerationLabel']['ParentName']] for label in moderation_labels)
        if unsafe:
            return "Video does not follow community standards", 400
        else:
            subtitles = get_subtitles(s3_key)
            return subtitles

@app.route('/get_tags', methods=['POST'])
def get_tags():
    rekognition = boto3.client('rekognition', region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    bucket_name = 'sp23-cloud-computing-project'
    data = request.get_json()['data']
    s3_key = data.split("/")[-1]
    response = rekognition.start_label_detection(
    Video={
        'S3Object': {
            'Bucket': bucket_name,
            'Name': s3_key
        }
    })
    res = []
    job_id = response['JobId']
    while True:
        response = rekognition.get_label_detection(JobId=job_id)
        status = response['JobStatus']
        if status == 'SUCCEEDED':
            break
        if status == 'FAILED':
            raise Exception('Label detection failed')
        time.sleep(5)
    labels = response['Labels']
    for label in labels:
        name = label['Label']['Name']
        confidence = label['Label']['Confidence']
        if confidence > 80 and name not in res:
            res.append(name)
    return jsonify(tags = res)

def get_subtitles(s3_file):
    #s3_file = request.json['data']
    s3 = boto3.client('s3',region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    transcribe = boto3.client('transcribe', region_name='us-east-1', aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
    timestr = time.strftime("%Y%m%d-%H%M%S")
    response = transcribe.start_transcription_job(
        TranscriptionJobName=f"{timestr}-transcription",
        LanguageCode='en-US',
        MediaFormat='mp4',
        Media={
            'MediaFileUri':f's3://sp23-cloud-computing-project/{s3_file}'
        },
        OutputBucketName = 'output-bucket-cloud',
        Subtitles={
        'Formats': [
            'srt'
        ],
        'OutputStartIndex': 1
        }
    )

    job_name = response['TranscriptionJob']['TranscriptionJobName']
    while True:
        status = transcribe.get_transcription_job(TranscriptionJobName=job_name)['TranscriptionJob']['TranscriptionJobStatus']
        if status in ['COMPLETED', 'FAILED']:
            break
        time.sleep(5)

    if status == 'COMPLETED':
        output_url = transcribe.get_transcription_job(TranscriptionJobName=job_name)['TranscriptionJob']['Transcript']['TranscriptFileUri']
        output_url = output_url.replace("json", "srt")
        transcriptionObject = s3.get_object(Bucket="output-bucket-cloud", Key=output_url.split('/')[-1])
        content = transcriptionObject['Body'].read()
        file_stream = BytesIO(content)
        return send_file(file_stream, mimetype='text/plain', as_attachment=True, download_name='transcription.srt')
    else:
        return 'Transcription job failed'
    
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')