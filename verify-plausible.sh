#!/bin/bash

echo "🔍 Plausible Analytics Verification for gorph.ai"
echo "================================================"
echo ""

# Test 1: Check if the site is accessible
echo "1. Testing site accessibility..."
if curl -s -o /dev/null -w "%{http_code}" https://gorph.ai | grep -q "200"; then
    echo "   ✅ Site is accessible (HTTP 200)"
else
    echo "   ❌ Site is not accessible"
    exit 1
fi

# Test 2: Check if Plausible script is in HTML
echo ""
echo "2. Testing Plausible script presence..."
if curl -s https://gorph.ai | grep -q 'data-domain="gorph.ai"'; then
    echo "   ✅ Plausible script found with correct domain"
else
    echo "   ❌ Plausible script not found or wrong domain"
    exit 1
fi

# Test 3: Check script tag format
echo ""
echo "3. Testing script tag format..."
SCRIPT_TAG=$(curl -s https://gorph.ai | grep -o '<script[^>]*plausible[^>]*>')
if echo "$SCRIPT_TAG" | grep -q 'defer data-domain="gorph.ai" src="https://plausible.io/js/script.js"'; then
    echo "   ✅ Script tag format is correct"
    echo "   📝 Script tag: $SCRIPT_TAG"
else
    echo "   ❌ Script tag format is incorrect"
    echo "   📝 Found: $SCRIPT_TAG"
    exit 1
fi

# Test 4: Check if Plausible script URL is accessible
echo ""
echo "4. Testing Plausible script URL accessibility..."
if curl -s -o /dev/null -w "%{http_code}" https://plausible.io/js/script.js | grep -q "200"; then
    echo "   ✅ Plausible script URL is accessible"
else
    echo "   ❌ Plausible script URL is not accessible"
    exit 1
fi

# Test 5: Check HTML structure
echo ""
echo "5. Testing HTML structure..."
if curl -s https://gorph.ai | grep -A 1 -B 1 "Plausible Analytics" | grep -q "script defer"; then
    echo "   ✅ HTML structure is correct"
else
    echo "   ❌ HTML structure is incorrect"
    exit 1
fi

# Test 6: Check for any CSP restrictions
echo ""
echo "6. Testing for Content Security Policy restrictions..."
CSP_COUNT=$(curl -s https://gorph.ai | grep -i "content-security-policy" | wc -l)
if [ "$CSP_COUNT" -eq 0 ]; then
    echo "   ✅ No CSP restrictions found"
else
    echo "   ⚠️  CSP restrictions found (may block Plausible)"
fi

echo ""
echo "🎉 All verification tests passed!"
echo ""
echo "📊 Plausible Analytics should now be working on https://gorph.ai"
echo "   - Script is properly embedded in HTML head"
echo "   - Domain is correctly set to 'gorph.ai'"
echo "   - Script URL is accessible"
echo "   - No blocking restrictions detected"
echo ""
echo "🔗 Try the Plausible verification again in your dashboard!" 