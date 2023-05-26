import * as fs from 'fs';
import * as readline from 'readline';
import axios from 'axios';

const API_KEY = '';
const API_URL = 'https://api.openai.com/v1/completions';

function countTokens(text: string): number {
  const regex = /\w+/g;
  const words = text.match(regex) || [];
  return words.length;
}

async function processChunk(chunk: string, promptTemplate: string, currentMinutes: string = ''): Promise<string> {
  const prompt = promptTemplate.replace('{chunk}', chunk).replace('{currentMinutes}', currentMinutes);
  const model = 'text-davinci-003'
  console.log('Processing chunk...');

  try {
    const response = await axios.post(API_URL, {
      prompt: prompt,
      model: model,
      max_tokens: 1800,
      n: 1,
      stop: null,
      temperature: 0.5,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    return response.data.choices[0].text.trim();
  } catch (error: any) {
    if (error.response && error.response.data) {
      console.error('Error in GPT-3 API request:', error.response.data);
    } else {
      console.error('Error in GPT-3 API request:', error);
    }
    throw error;
  }
}

async function processFile(inputFilename: string, promptTemplate: string, currentMinutes: string = ''): Promise<string[]> {
  const totalLines = fs.readFileSync(inputFilename, 'utf-8').split('\n').length;

  const fileStream = fs.createReadStream(inputFilename, 'utf-8');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let chunk = '';
  let chunkTokens = 0;
  let linesRead = 0;
  let results: string[] = [];

  for await (const line of rl) {
    const lineTokens = countTokens(line);
    if (chunkTokens + lineTokens + 1 > 500) {
      const processedChunk = await processChunk(chunk, promptTemplate, currentMinutes);
      results.push(processedChunk);
      chunk = '';
      chunkTokens = 0;
    }

    chunk += line + '\n';
    chunkTokens += lineTokens + 1;

    // Update the progress
    linesRead++;
    console.log(`Progress: ${linesRead}/${totalLines} lines read (${Math.round((linesRead / totalLines) * 100)}%)`);
  }

  if (chunk) {
    const processedChunk = await processChunk(chunk, promptTemplate, currentMinutes);
    results.push(processedChunk);
  }

  return results;
}

async function generateMeetingMinutes(transcriptFilename: string, templateFilename: string, summaryFilename: string, outputFilename: string): Promise<void> {
  const summarizePromptTemplate = 'Provide a summary of the transcript chunk provided. Do not shed details:\n\n{chunk}\nSummary: ';
  const summaries = await processFile(transcriptFilename, summarizePromptTemplate);
  console.log('Summaries generated.');

  // Write summaries to a file
  fs.writeFileSync(summaryFilename, summaries.join('\n'));
  console.log('Summaries written to file.');

  // const currentMinutes = fs.readFileSync(templateFilename, 'utf-8');
  //
  // const updateMinutesPromptTemplate = `Here is the current meeting minutes structure:\n\n{currentMinutes}\n\nPlease update the meeting minutes with the following new summarized information and combine any duplicated sections. Use a consistent, bullet list format for section content:\n\n{chunk}\nUpdated meeting minutes: `;
  // const updatedMinutesList = await processFile(summaryFilename, updateMinutesPromptTemplate, currentMinutes);
  // console.log('Meeting minutes generated.');
  //
  // const updatedMinutes = updatedMinutesList.join('\n');
  // fs.writeFileSync(outputFilename, updatedMinutes);
  // console.log('Meeting minutes written to file.');
}

if (process.argv.length < 5) {
  console.error('Missing command or arguments. Please use the "generateMeetingMinutes" command.');
  process.exit(1);
}

const command = process.argv[2];

if (command === 'generateMeetingMinutes') {
  const transcriptFilename = process.argv[3];
  const templateFilename = process.argv[4];
  const summaryFilename = process.argv[5];
  const outputFilename = process.argv[6];
  generateMeetingMinutes(transcriptFilename, templateFilename, summaryFilename, outputFilename).catch(console.error);
} else {
  console.error('Invalid command. Please use the "generateMeetingMinutes" command.');
  process.exit(1);
}
