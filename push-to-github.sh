#!/bin/bash

# GitHub Push Script
# Replace YOUR_GITHUB_USERNAME with your actual GitHub username

echo "🚀 Connecting to GitHub and pushing repository..."
echo ""
echo "📋 Replace the URL below with your actual GitHub repository URL:"
echo "Example: https://github.com/YOUR_USERNAME/sdr-assignment-system.git"
echo ""

# You'll need to replace this URL with your actual GitHub repository URL
GITHUB_URL="https://github.com/YOUR_USERNAME/sdr-assignment-system.git"

echo "Current commands that will be run:"
echo ""
echo "git remote add origin $GITHUB_URL"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "⚠️  Make sure to replace YOUR_USERNAME with your actual GitHub username!"
echo ""

# Uncomment these lines after setting the correct URL:
# git remote add origin $GITHUB_URL
# git branch -M main
# git push -u origin main

echo "✅ Script ready. Edit the GITHUB_URL variable above with your repository URL."
echo "Then uncomment the git commands and run: ./push-to-github.sh"