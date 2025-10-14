import "dotenv/config";
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API Key...\n');

  // Check if API key is set
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ ERROR: GEMINI_API_KEY is not set in .env file');
    console.log('Please add your Gemini API key to the .env file:');
    console.log('GEMINI_API_KEY=your_actual_api_key_here');
    return;
  }

  console.log('✅ API key found in environment variables');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Try different model names that might be available
    const modelsToTry = [
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-pro',
      'gemini-1.0-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-latest'
    ];

    console.log('🔍 Testing available models...\n');

    let workingModel = null;
    let workingModelName = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const testPrompt = 'Say "OK" if you can read this.';
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        const text = response.text();

        console.log(`✅ ${modelName} works!\n`);
        workingModel = model;
        workingModelName = modelName;
        break;
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message.split('\n')[0]}`);
      }
    }

    if (!workingModel) {
      console.log('\n❌ None of the common models are available');
      console.log('This might be an API key issue or API version mismatch');
      return;
    }

    console.log('📡 Running full API test...');

    const testPrompt = 'Hello! Please respond with just "API key is working" if you can read this message.';
    const result = await workingModel.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('\n🎉 SUCCESS! Gemini API is working!');
    console.log('📝 API Response:', text.trim());
    console.log(`🤖 Working model: ${workingModelName}`);
    console.log('🔑 API Key Status: Valid and active\n');

    console.log('✅ You can now generate AI-powered language courses!');
    console.log(`\n💡 Update your geminiService.js to use: '${workingModelName}'`);

  } catch (error) {
    console.log('\n❌ ERROR: Gemini API test failed');
    console.log('📋 Error details:', error.message);

    if (error.message.includes('API_KEY_INVALID')) {
      console.log('\n🔧 SOLUTION: Your Gemini API key is invalid');
      console.log('   1. Go to https://makersuite.google.com/app/apikey');
      console.log('   2. Create a new API key');
      console.log('   3. Replace the key in your .env file');
      console.log('   4. Run this test again');
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      console.log('\n🔧 SOLUTION: API quota exceeded');
      console.log('   1. You\'ve used up your free tier quota');
      console.log('   2. Wait for the quota to reset (usually daily)');
      console.log('   3. Or upgrade to a paid plan');
    } else if (error.message.includes('fetch')) {
      console.log('\n🔧 SOLUTION: Network connection issue');
      console.log('   1. Check your internet connection');
      console.log('   2. Make sure you can access Google services');
      console.log('   3. Try again in a few minutes');
    } else {
      console.log('\n🔧 SOLUTION: Unknown error');
      console.log('   1. Check your API key format');
      console.log('   2. Make sure @google/generative-ai is installed');
      console.log('   3. Try running: npm install @google/generative-ai');
    }

    console.log('\n💡 Need help? Get a new API key at: https://makersuite.google.com/app/apikey');
  }
}

// Run the test
testGeminiAPI();
