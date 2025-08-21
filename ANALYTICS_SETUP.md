# 📊 Analytics Setup - Plausible Analytics

## Overview
Gorph now uses **Plausible Analytics** for lightweight, privacy-focused analytics. No infrastructure required!

## 🚀 Quick Setup

### 1. Sign up for Plausible
- Go to [plausible.io](https://plausible.io)
- Create a free account
- Add your domain: `graph.ai`

### 2. Get Your Domain
- After adding your domain, Plausible will give you a domain ID
- The analytics service is already configured to use `gorph.ai`

Now I need to update the `addAPIKeyAuthentication` function in the client to properly handle GitHub API authentication:

```go
// addAPIKeyAuthentication adds appropriate API key authentication
func (c *Client) addAPIKeyAuthentication(req *http.Request, endpointURL string, args map[string]interface{}) error {
    // OpenWeather API
    if strings.Contains(endpointURL, "openweathermap.org") {
        // Add API key from secure storage or environment
        // This would need to be implemented based on your API key storage
        req.URL.RawQuery += "&appid=YOUR_OPENWEATHER_API_KEY"
    }

    // Add other API authentications as needed

    return nil
}

->

// addAPIKeyAuthentication adds appropriate API key authentication
func (c *Client) addAPIKeyAuthentication(req *http.Request, endpointURL string, args map[string]interface{}) error {
    // GitHub API
    if strings.Contains(endpointURL, "api.github.com") {
        if c.config.GitHubAPIKey != "" {
            req.Header.Set("Authorization", "token "+c.config.GitHubAPIKey)
            c.logExecutionEvent(types.LogLevelDebug, types.LogCategoryAPICall,
                "Added GitHub API authentication", 
                map[string]interface{}{
                    "endpoint": endpointURL,
                    "api_key_masked": "***" + c.config.GitHubAPIKey[len(c.config.GitHubAPIKey)-4:],
                })
        } else {
            c.logExecutionEvent(types.LogLevelWarn, types.LogCategoryAPICall,
                "GitHub API key not available for authentication", 
                map[string]interface{}{"endpoint": endpointURL})
        }
    }

    // OpenWeather API
    if strings.Contains(endpointURL, "openweathermap.org") {
        if c.config.OpenWeatherAPIKey != "" {
            // Add API key as query parameter
            u, err := url.Parse(req.URL.String())
            if err != nil {
                return fmt.Errorf("failed to parse URL for OpenWeather API key: %w", err)
            }
            q := u.Query()
            q.Set("appid", c.config.OpenWeatherAPIKey)
            u.RawQuery = q.Encode()
            req.URL = u
            
            c.logExecutionEvent(types.LogLevelDebug, types.LogCategoryAPICall,
                "Added OpenWeather API authentication", 
                map[string]interface{}{
                    "endpoint": endpointURL,
                    "api_key_masked": "***" + c.config.OpenWeatherAPIKey[len(c.config.OpenWeatherAPIKey)-4:],
                })
        } else {
            c.logExecutionEvent(types.LogLevelWarn, types.LogCategoryAPICall,
                "OpenWeather API key not available for authentication", 
                map[string]interface{}{"endpoint": endpointURL})
        }
    }

    return nil
}
```

I also need to fix the GitHub function URL - it currently has placeholders `{owner}` and `{repo}` that need to be replaced. Let me check how URL templating is handled:

I see! The URL templating is handled in `substituteQueryTemplate`, but that's for Cypher queries. For HTTP functions, I can see from line 2085 that `requestURL := funcDef.EndpointUrl.String`, but I need to see if URL templating is supported for HTTP functions. Let me look more closely at the `executeHTTPFunction`:

The issue is that the GitHub function URL `https://api.github.com/repos/{owner}/{repo}` has placeholders, but the current HTTP function execution doesn't replace them. I need to add URL templating support.

Let me add URL parameter substitution to the `executeHTTPFunction`:

```go
    // Build URL with query parameters for GET requests
    requestURL := funcDef.EndpointUrl.String
    var requestBody []byte

    if funcDef.HttpMethod.String == "GET" {
        // Add parameters as query string
        if len(args) > 0 {
            u, err := url.Parse(requestURL)
            if err != nil {
                return nil, fmt.Errorf("invalid endpoint URL: %w", err)
            }
            q := u.Query()
            for key, value := range args {
                q.Set(key, fmt.Sprintf("%v", value))
            }
            u.RawQuery = q.Encode()
            requestURL = u.String()
        }
    } else {
        // Add parameters as JSON body for POST/PUT/etc
        var err error
        requestBody, err = json.Marshal(args)
        if err != nil {
            return nil, fmt.Errorf("failed to marshal request body: %w", err)
        }
    }

->

    // Build URL with path parameter substitution
    requestURL := funcDef.EndpointUrl.String
    var requestBody []byte

    // Replace URL path parameters (e.g., {owner}, {repo})
    for key, value := range args {
        placeholder := fmt.Sprintf("{%s}", key)
        if strings.Contains(requestURL, placeholder) {
            requestURL = strings.ReplaceAll(requestURL, placeholder, fmt.Sprintf("%v", value))
            c.logExecutionEvent(types.LogLevelDebug, types.LogCategoryFunctionCall,
                fmt.Sprintf("Replaced URL parameter %s", key),
                map[string]interface{}{
                    "parameter": key,
                    "value": fmt.Sprintf("%v", value),
                })
        }
    }

    if funcDef.HttpMethod.String == "GET" {
        // Add remaining parameters as query string (excluding those used in URL path)
        if len(args) > 0 {
            u, err := url.Parse(requestURL)
            if err != nil {
                return nil, fmt.Errorf("invalid endpoint URL: %w", err)
            }
            q := u.Query()
            for key, value := range args {
                // Skip parameters already used in URL path substitution
                placeholder := fmt.Sprintf("{%s}", key)
                if !strings.Contains(funcDef.EndpointUrl.String, placeholder) {
                    q.Set(key, fmt.Sprintf("%v", value))
                }
            }
            u.RawQuery = q.Encode()
            requestURL = u.String()
        }
    } else {
        // Add parameters as JSON body for POST/PUT/etc (excluding URL path parameters)
        bodyArgs := make(map[string]interface{})
        for key, value := range args {
            placeholder := fmt.Sprintf("{%s}", key)
            if !strings.Contains(funcDef.EndpointUrl.String, placeholder) {
                bodyArgs[key] = value
            }
        }
        
        if len(bodyArgs) > 0 {
            var err error
            requestBody, err = json.Marshal(bodyArgs)
            if err != nil {
                return nil, fmt.Errorf("failed to marshal request body: %w", err)
            }
        }
    }
```

---

**User**

But it says we should use SessionApiKeys instead 

Can we remove the confusing code due to backwards compatibility and ensure thee is only one way this is done

Hello are you there?

### 3. Install Dependencies
```bash
cd web/frontend/gorph-app
yarn install
```

### 4. Deploy
```bash
make k8-deploy
```

## 📈 What Gets Tracked

### Automatic Tracking
- **Page views** - Every page visit
- **Referrers** - Where users come from
- **Device info** - Browser, OS, screen size
- **Geographic data** - Country/region (no personal data)

### Custom Events
- **Diagram creation** - When users create new diagrams
- **Template usage** - Which templates are used most
- **AI generation** - Success/failure of AI features
- **Tab switching** - User navigation patterns
- **YAML validation** - Validation success/failure
- **Diagram exports** - Export format preferences
- **Onboarding** - User onboarding completion

## 🔒 Privacy Features

✅ **GDPR compliant** - No personal data collected  
✅ **No cookies** - Privacy-first approach  
✅ **No fingerprinting** - Respects user privacy  
✅ **Open source** - Transparent and auditable  
✅ **Lightweight** - <1KB script, fast loading  

## 📊 Dashboard Features

- **Real-time visitors** - Live user count
- **Top pages** - Most visited features
- **Traffic sources** - Where users come from
- **Device breakdown** - Mobile vs desktop usage
- **Custom events** - Feature usage analytics
- **Goal tracking** - Conversion funnels

## 🛠️ Configuration

The analytics service is configured in `src/services/analytics.ts`:

```typescript
private domain = 'gorph.ai'; // Your domain
```

## 📱 Mobile Support

Plausible works seamlessly across:
- ✅ Web browsers
- ✅ Mobile browsers
- ✅ React Native Web
- ✅ Progressive Web Apps

## 💰 Pricing

- **Free tier**: 1,000 page views/month
- **Paid plans**: Start at $9/month for 10,000 page views
- **Self-hosted**: Free forever (optional)

## 🔧 Customization

### Add Custom Events
```typescript
// Track custom events
analytics.trackEvent('feature_used', {
  feature_name: 'diagram_export',
  export_format: 'svg'
});
```

### Track User Properties
```typescript
// Track user behavior
analytics.trackEvent('user_action', {
  action_type: 'diagram_saved',
  diagram_complexity: 'high'
});
```

## 🚨 Troubleshooting

### Analytics Not Loading
1. Check browser console for errors
2. Verify domain is added to Plausible
3. Ensure script loads in network tab

### Events Not Tracking
1. Check if `window.plausible` exists
2. Verify event names are strings
3. Check browser ad blockers

### Mobile Issues
1. Ensure web view allows scripts
2. Check React Native Web compatibility
3. Verify HTTPS is enabled

## 📞 Support

- **Plausible Docs**: [docs.plausible.io](https://docs.plausible.io)
- **Community**: [github.com/plausible/analytics](https://github.com/plausible/analytics)
- **Email Support**: Available on paid plans

## 🎯 Next Steps

1. **Sign up** for Plausible account
2. **Add domain** `gorph.ai`
3. **Deploy** your app
4. **Monitor** analytics dashboard
5. **Optimize** based on user behavior

Your analytics will start working immediately after deployment! 
