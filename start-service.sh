#!/bin/bash

# Wiki-Drafter Companion Service Startup Script

echo "🚀 Starting Wiki-Drafter Companion Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8 or later and try again."
    exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "❌ pip is required but not found."
    echo "Please install pip and try again."
    exit 1
fi

# Navigate to service directory
cd "$(dirname "$0")/services/local" || exit 1

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "📚 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if configuration files exist
if [ ! -f "rsp_cache.json" ]; then
    echo "⚠️  Warning: rsp_cache.json not found. Service will use defaults."
fi

if [ ! -f "sources.json" ]; then
    echo "📝 Creating empty sources.json..."
    echo "{}" > sources.json
fi

# Start the service
echo "🌟 Starting companion service on http://localhost:8000..."
echo "Press Ctrl+C to stop the service"
echo ""

python app.py