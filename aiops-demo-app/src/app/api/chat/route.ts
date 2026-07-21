/**
 * Simulated Chatbot API
 * Uses keyword matching to simulate an AI assistant for product and issue queries.
 */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const query = message.toLowerCase();
    
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 800));

    let response = "I'm sorry, I didn't quite catch that. How can I help you with our products or your order today?";

    // Issue Queries
    if (query.includes('cart') && (query.includes('broken') || query.includes('error') || query.includes('fail') || query.includes('not working'))) {
      response = "It looks like you're having trouble with your cart. Our engineering team has been automatically notified, and our autonomous systems are working to restore the service cache. Please try again in a few moments!";
    } else if (query.includes('checkout') || query.includes('pay') || query.includes('timeout')) {
      response = "Are you experiencing a delay during checkout? This might be due to our payment provider taking longer than usual. We're routing your request through a backup gateway. Please hold on!";
    } 
    // Product Queries
    else if (query.includes('deal') || query.includes('discount') || query.includes('offer')) {
      response = "Today's best deal is on the NovaBook Pro! It's an incredible machine for professionals. Would you like me to add it to your cart?";
    } else if (query.includes('phone') || query.includes('smartphone')) {
      response = "The NovaPhone X is our top-selling smartphone, featuring a brilliant display and an AI-powered camera system.";
    } else if (query.includes('hello') || query.includes('hi ')) {
      response = "Hello there! Welcome to NovaCart. How can I assist you with your shopping experience today?";
    }

    return NextResponse.json({ reply: response });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process message' }, { status: 400 });
  }
}
