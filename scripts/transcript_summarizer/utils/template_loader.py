"""
Template loader utilities for transcript summarization
"""

import os
import yaml
import re
from collections import Counter

def load_prompt_template(template_name):
    """Load a prompt template from the templates directory
    
    Args:
        template_name (str): Name of the template file (without extension)
        
    Returns:
        str: Template content as a string
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, 'templates', f'{template_name}.txt')
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error loading template '{template_name}': {e}")
        return ""

def load_summary_templates():
    """Load all summary templates from the YAML files
    
    Returns:
        dict: Dictionary of templates by genre
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, 'templates', 'summary_templates.yaml')
    hybrid_template_path = os.path.join(base_dir, 'templates', 'hybrid_templates.yaml')
    
    templates = {
        "default": {
            "intro": "This video covers {title_topic}.",
            "structure": ["Main Points:", "Key Insights:"],
            "tone": "informative",
            "emoji": "📺",
            "keywords": ["video", "content", "information"]
        }
    }
    
    # Load main templates
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            main_templates = yaml.safe_load(f)
            templates.update(main_templates)
    except Exception as e:
        print(f"Error loading main summary templates: {e}")
    
    # Load hybrid templates
    try:
        with open(hybrid_template_path, 'r', encoding='utf-8') as f:
            hybrid_templates = yaml.safe_load(f)
            templates.update(hybrid_templates)
    except Exception as e:
        print(f"Error loading hybrid templates: {e}")
        
    return templates

def get_summary_template(genre, content_type, templates=None, transcript_text=None, video_title=None):
    """Get the appropriate summary template based on video genre and content type
    with enhanced detection using transcript text and title if available
    
    Args:
        genre (str): Detected genre of the video
        content_type (str): Detected content type
        templates (dict, optional): Pre-loaded templates dictionary
        transcript_text (str, optional): Transcript text for additional analysis
        video_title (str, optional): Video title for additional analysis
        
    Returns:
        dict: Template dictionary for the genre
    """
    if templates is None:
        templates = load_summary_templates()
    
    # If we have transcript or title text, use them for enhanced detection
    if transcript_text or video_title:
        detected_template = detect_template_from_content(
            templates, 
            transcript_text=transcript_text,
            video_title=video_title,
            detected_genre=genre
        )
        if detected_template:
            return detected_template
    
    # Normalize genre to match template keys
    norm_genre = genre.lower() if genre else ""
    
    # Direct match first (exact template name)
    if norm_genre in templates:
        return templates[norm_genre]
    
    # Map of genre keywords to template keys
    # This is a fallback if the enhanced detection doesn't work
    genre_mapping = {
        "educational": ["educational", "tutorial", "course", "learn"],
        "tutorial": ["tutorial", "how-to", "how to"],
        "podcast": ["podcast"],
        "interview": ["interview", "conversation"],
        "entertainment": ["entertainment"],
        "vlog": ["vlog", "daily", "personal"],
        "news": ["news", "commentary"],
        "documentary": ["documentary"],
        "review": ["review", "analysis"],
        "gaming": ["gaming", "gameplay", "game"],
        "sports": ["sports", "highlight", "athletic"],
        "movie_recap": ["movie", "recap", "film", "show"],
        "music": ["music", "performance", "concert"],
        "cooking": ["cooking", "recipe", "food"],
        "motivational": ["motivational", "self-help", "inspiration"],
        "technical": ["technical", "developer", "programming", "coding"],
        "business": ["business", "finance", "investment"],
        "health": ["health", "fitness", "workout"],
        "travel": ["travel", "destination", "tourism"],
        "science": ["science", "explainer"],
        "comedy": ["comedy", "humor", "funny"],
        "reaction": ["reaction", "reacting", "react"],
        "unboxing": ["unboxing", "package", "unbox"],
        "debate": ["debate", "versus", "vs"],
        "history": ["history", "historical", "ancient"],
        "diy": ["diy", "do it yourself", "craft"],
        "technology": ["technology", "tech", "gadget"],
        "beauty": ["beauty", "makeup", "cosmetic"]
    }
    
    # Find matching template by checking if any keyword is in the genre
    for template_key, keywords in genre_mapping.items():
        if any(keyword in norm_genre for keyword in keywords):
            return templates.get(template_key, templates["default"])
    
    # If content type can help determine template
    content_type_mapping = {
        "instructional": ["tutorial", "educational", "diy", "cooking"],
        "informational": ["educational", "documentary", "news", "science"],
        "conversational": ["interview", "podcast", "debate"],
        "narrative": ["movie_recap", "documentary", "history"],
        "analytical": ["review", "technical", "science", "business"],
        "demonstrative": ["tutorial", "cooking", "diy", "beauty"],
        "entertaining": ["comedy", "entertainment", "gaming", "reaction"],
        "persuasive": ["motivational", "review", "business"],
        "inspirational": ["motivational", "sports"]
    }
    
    norm_content_type = content_type.lower() if content_type else ""
    for ct_type, template_keys in content_type_mapping.items():
        if ct_type in norm_content_type:
            # Return the first matching template
            for key in template_keys:
                if key in templates:
                    return templates[key]
    
    # Default template if no match found
    return templates.get("default")

def detect_template_from_content(templates, transcript_text=None, video_title=None, detected_genre=None):
    """Detect the most appropriate template based on content analysis
    
    Args:
        templates (dict): Dictionary of templates
        transcript_text (str, optional): Transcript text for analysis
        video_title (str, optional): Video title for analysis
        detected_genre (str, optional): Pre-detected genre to use as a hint
        
    Returns:
        dict: Best matching template or None if insufficient data
    """
    if not templates or (not transcript_text and not video_title):
        return None
    
    # Prepare text for analysis
    analysis_text = ""
    if video_title:
        # Title is weighted more heavily
        analysis_text += video_title.lower() + " " + video_title.lower() + " "
        
    if transcript_text:
        # Get a sample of the transcript for analysis
        sample_size = min(len(transcript_text), 2000)
        analysis_text += transcript_text[:sample_size].lower()
    
    # Calculate scores for each template based on keyword matches
    template_scores = {}
    for template_name, template in templates.items():
        if 'keywords' not in template:
            continue
            
        score = 0
        # Check for keyword matches
        for keyword in template['keywords']:
            # Multi-word keywords need exact matches
            if " " in keyword and keyword in analysis_text:
                # Multi-word matches are weighted more heavily
                score += 3
                
                # Extra weight for multi-word keywords in title
                if video_title and keyword in video_title.lower():
                    score += 4
                    
            # Single word keywords can have partial matches
            elif " " not in keyword and re.search(r'\b' + re.escape(keyword) + r'\b', analysis_text):
                score += 1
                
                # Extra weight for keywords in title
                if video_title and re.search(r'\b' + re.escape(keyword) + r'\b', video_title.lower()):
                    score += 2
                
        # Give bonus points if the detected genre matches this template
        if detected_genre and detected_genre.lower() in template_name.lower():
            score += 5
            
        # Give bonus points for hybrid templates that match multiple genres
        if "_" in template_name:
            genres = template_name.split("_")
            for genre in genres:
                if detected_genre and genre.lower() in detected_genre.lower():
                    score += 3
                    
                # Check if multiple aspects are present in title or transcript
                keywords_count = 0
                for keyword in template['keywords']:
                    if keyword in analysis_text:
                        keywords_count += 1
                        
                # Hybrid templates should match multiple keywords
                if keywords_count >= 3:
                    score += 2
            
        # Store the score
        template_scores[template_name] = score
    
    # Get the top 3 templates with scores
    top_templates = sorted(template_scores.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Log the top candidates
    if top_templates:
        print(f"Top template candidates:")
        for name, score in top_templates:
            print(f"  - {name} (score: {score})")
    
    # Get the template with the highest score
    if top_templates:
        best_match = top_templates[0]
        # Only return if score is above threshold
        if best_match[1] >= 3:  # Increased threshold for better accuracy
            print(f"Template detection - Selected: {best_match[0]} (score: {best_match[1]})")
            return templates[best_match[0]]
        else:
            print(f"Template detection - No strong match (highest: {best_match[0]}, score: {best_match[1]})")
    
    return None

def get_template_recommendations(transcript_text, video_title, templates=None, top_n=3):
    """Get multiple template recommendations ranked by relevance
    
    Args:
        transcript_text (str): Transcript text for analysis
        video_title (str): Video title for analysis
        templates (dict, optional): Pre-loaded templates dictionary
        top_n (int): Number of recommendations to return
        
    Returns:
        list: List of tuples (template_name, score) sorted by relevance
    """
    if templates is None:
        templates = load_summary_templates()
        
    # Prepare text for analysis
    analysis_text = ""
    if video_title:
        # Title is weighted more heavily
        analysis_text += video_title.lower() + " " + video_title.lower() + " "
        
    if transcript_text:
        # Get a sample of the transcript for analysis
        sample_size = min(len(transcript_text), 3000)
        analysis_text += transcript_text[:sample_size].lower()
    
    # Calculate scores for each template based on keyword matches
    template_scores = {}
    for template_name, template in templates.items():
        if 'keywords' not in template:
            continue
            
        score = 0
        # Check for keyword matches
        for keyword in template['keywords']:
            # Multi-word keywords need exact matches
            if " " in keyword and keyword in analysis_text:
                # Multi-word matches are weighted more heavily
                score += 3
                
                # Bonus for keyword in title
                if video_title and keyword in video_title.lower():
                    score += 3
            # Single word keywords can have partial matches
            elif " " not in keyword and re.search(r'\b' + re.escape(keyword) + r'\b', analysis_text):
                score += 1
                
                # Bonus for keyword in title
                if video_title and re.search(r'\b' + re.escape(keyword) + r'\b', video_title.lower()):
                    score += 2
                    
        # Store the score
        template_scores[template_name] = score
    
    # Sort templates by score and return top N
    sorted_templates = sorted(template_scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_templates[:top_n]