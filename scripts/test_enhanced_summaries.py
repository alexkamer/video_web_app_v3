#!/usr/bin/env python3
"""
Test script for the enhanced summary system with genre detection and sentiment analysis
"""

import asyncio
import sys
import os
import dotenv

# Add the current directory to the path so we can import the package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env.local
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

from transcript_summarizer.summarizer import TranscriptSummarizer

async def test_enhanced_summaries():
    """Test the enhanced summary system with different video types"""
    
    # Sample video content for different genres
    test_cases = [
        {
            "title": "How to Build a Streamlit App in 10 Minutes",
            "genre": "technical_developer",
            "content": """
            Hey everyone! In this tutorial, I'm going to show you how to build a Streamlit app in just 10 minutes. 
            Streamlit is an amazing Python library that lets you create web apps with just a few lines of code.
            
            First, let's install Streamlit using pip. Just run 'pip install streamlit' in your terminal.
            Now, create a new Python file called app.py. We'll start with a simple example.
            
            Import streamlit as st, and let's create a basic app. We can add text with st.write(), 
            create input fields with st.text_input(), and add buttons with st.button().
            
            The cool thing about Streamlit is that it runs your code from top to bottom every time 
            there's an interaction. This makes it super easy to create interactive apps.
            
            Let's build a simple calculator. We'll add two number inputs and a button to calculate the sum.
            When you click the button, Streamlit will re-run the script and update the result.
            
            For data visualization, you can use st.line_chart(), st.bar_chart(), or even plotly charts.
            Streamlit works great with pandas DataFrames too.
            
            To run your app, just use 'streamlit run app.py' in the terminal. It will open in your browser automatically.
            You can also deploy it to Streamlit Cloud for free!
            
            That's it! You now have a working Streamlit app. The possibilities are endless - you can create
            dashboards, data exploration tools, machine learning demos, and much more.
            """
        },
        {
            "title": "EPIC GAMING MOMENTS - Best Plays of the Week",
            "genre": "gaming",
            "content": """
            What's up gamers! Welcome to another episode of Epic Gaming Moments!
            
            Oh my god, you guys are not going to believe what just happened! This play right here is absolutely insane!
            Look at this clutch moment - the player is down to 1 HP, surrounded by enemies, and somehow pulls off the impossible!
            
            The timing on this ultimate ability is perfect! Just look at that precision - absolutely beautiful!
            And here we have another incredible play where the team coordinates perfectly for a team wipe.
            
            This player's mechanical skills are off the charts! The way they dodge every skill shot while landing perfect counter-attacks.
            This is why I love this game - moments like these make all the grinding worth it!
            
            Check out this insane combo - it's like watching poetry in motion! The enemy team had no idea what hit them.
            And the crowd goes wild! This is what competitive gaming is all about!
            
            Don't forget to like and subscribe for more epic gaming content! Drop a comment below with your favorite play of the week!
            """
        },
        {
            "title": "Inspiring Speech: How to Overcome Any Challenge",
            "genre": "motivational_selfhelp",
            "content": """
            Hello everyone, today I want to share something deeply personal with you.
            
            Life is not about waiting for the storm to pass, it's about learning to dance in the rain.
            I know that sounds cliché, but hear me out because this changed my entire perspective.
            
            Three years ago, I was at my lowest point. I had lost my job, my relationship was falling apart,
            and I felt like giving up. But then I realized something profound - our greatest growth comes from our biggest challenges.
            
            Every obstacle you face is actually an opportunity in disguise. When life knocks you down,
            you have two choices: stay down or get back up stronger than ever.
            
            I want you to remember this: you are stronger than you think, more capable than you believe,
            and more resilient than you know. Your potential is limitless.
            
            Start small, but start today. Take one step forward, even if it's tiny. Progress is progress,
            no matter how small. And before you know it, you'll look back and see how far you've come.
            
            Believe in yourself, because I believe in you. You have the power to create the life you want.
            Let's do this together!
            """
        }
    ]
    
    print("Testing Enhanced Summary System")
    print("=" * 60)
    
    try:
        # Create summarizer instance
        summarizer = TranscriptSummarizer(debug_output=True)
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n{'='*20} TEST CASE {i}: {test_case['title']} {'='*20}")
            print(f"Expected Genre: {test_case['genre']}")
            print("\n" + "-" * 60)
            
            # Test genre detection
            print("🔍 Detecting genre and sentiment...")
            genre_info = await summarizer.detect_video_genre_async(test_case['content'], test_case['title'])
            
            print(f"📊 Detected Genre: {genre_info.get('genre', 'unknown')}")
            print(f"📊 Content Type: {genre_info.get('content_type', 'unknown')}")
            print(f"📊 Sentiment: {genre_info.get('sentiment', 'unknown')}")
            print(f"📊 Tone: {genre_info.get('tone', 'unknown')}")
            print(f"📊 Engagement Style: {genre_info.get('engagement_style', 'unknown')}")
            
            # Test summary generation
            print("\n📝 Generating enhanced summary...")
            summary = await summarizer.summarize_async(test_case['content'], test_case['title'])
            
            print("\n✨ Enhanced Summary:")
            print(summary)
            print("\n" + "-" * 60)
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_enhanced_summaries())
