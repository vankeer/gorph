import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';

interface APIKeyConfigProps {
  visible: boolean;
  onClose: () => void;
}

interface APIKeySettings {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom' | '';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: string;
}

interface DiscoveredModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  max_model_len?: number;
}

export const APIKeyConfig: React.FC<APIKeyConfigProps> = ({ visible, onClose }) => {
  const [settings, setSettings] = useState<APIKeySettings>({
    provider: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    maxTokens: ''
  });
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [isDiscoveringModels, setIsDiscoveringModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const getCustomEndpointUrl = (baseUrl: string, path: 'models' | 'chat/completions') => {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    if (normalized.endsWith(`/v1/${path}`)) return normalized;
    if (normalized.endsWith('/v1')) return `${normalized}/${path}`;
    return `${normalized}/v1/${path}`;
  };

  const discoverModels = async (baseUrl: string, apiKey: string, signal?: AbortSignal) => {
    setIsDiscoveringModels(true);
    try {
      const response = await fetch(getCustomEndpointUrl(baseUrl, 'models'), {
        method: 'GET',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        }
      });

      if (!response.ok) {
        setDiscoveredModels([]);
        return;
      }

      const data = await response.json();
      const models = (data.data || []).filter((model: unknown): model is DiscoveredModel => {
        return typeof model === 'object' && model !== null && typeof (model as DiscoveredModel).id === 'string';
      });

      setDiscoveredModels(models);
      setSettings(prev => prev.model || models.length === 0 ? prev : { ...prev, model: models[0].id });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('Error discovering models:', error);
        setDiscoveredModels([]);
      }
    } finally {
      if (!signal?.aborted) {
        setIsDiscoveringModels(false);
      }
    }
  };

  const loadSettings = async () => {
    try {
      // Try to load from localStorage (web) or AsyncStorage (mobile)
      const openaiKey = localStorage?.getItem('openai_api_key') || '';
      const anthropicKey = localStorage?.getItem('anthropic_api_key') || '';
      const geminiKey = localStorage?.getItem('gemini_api_key') || '';
      const customKey = localStorage?.getItem('custom_api_key') || '';
      const customBaseUrl = localStorage?.getItem('custom_base_url') || '';
      const customMaxTokens = localStorage?.getItem('custom_max_tokens') || '';

      let provider: 'openai' | 'anthropic' | 'gemini' | 'custom' | '' = '';
      let apiKey = '';

      if (openaiKey) {
        provider = 'openai';
        apiKey = openaiKey;
      } else if (anthropicKey) {
        provider = 'anthropic';
        apiKey = anthropicKey;
      } else if (geminiKey) {
        provider = 'gemini';
        apiKey = geminiKey;
      } else if (customBaseUrl) {
        provider = 'custom';
        apiKey = customKey;
      }

      const savedModel = localStorage?.getItem(`${provider}_model`) || '';
      setSettings({
        provider,
        apiKey,
        baseUrl: provider === 'custom' ? customBaseUrl : '',
        model: savedModel,
        maxTokens: provider === 'custom' ? customMaxTokens : ''
      });

    } catch (error) {
      console.log('Failed to load API settings:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  useEffect(() => {
    if (settings.provider !== 'custom' || !settings.baseUrl?.trim()) {
      setDiscoveredModels([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      discoverModels(settings.baseUrl!.trim(), settings.apiKey || '', controller.signal);
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [settings.provider, settings.baseUrl, settings.apiKey]);

  const saveSettings = async () => {
    try {
      if (!settings.provider) {
        setTestResult({ success: false, message: 'Please select a provider' });
        return;
      }

      // Custom provider: baseUrl required, API key optional
      if (settings.provider === 'custom' && !settings.baseUrl?.trim()) {
        setTestResult({ success: false, message: 'Please enter a base URL for custom endpoint' });
        return;
      }

      // Non-custom providers: API key required
      if (settings.provider !== 'custom' && !settings.apiKey) {
        setTestResult({ success: false, message: 'Please enter an API key' });
        return;
      }

      // Clear other provider keys first
      localStorage?.removeItem('openai_api_key');
      localStorage?.removeItem('anthropic_api_key');
      localStorage?.removeItem('gemini_api_key');
      localStorage?.removeItem('custom_api_key');
      localStorage?.removeItem('custom_base_url');
      localStorage?.removeItem('custom_model');
      localStorage?.removeItem('custom_max_tokens');

      // Save the selected provider's key
      localStorage?.setItem(`${settings.provider}_api_key`, settings.apiKey);

      if (settings.model) {
        localStorage?.setItem(`${settings.provider}_model`, settings.model);
      }

      // Save custom endpoint settings if applicable
      if (settings.provider === 'custom' && settings.baseUrl) {
        localStorage?.setItem('custom_base_url', settings.baseUrl.trim());
        if (settings.maxTokens) {
          localStorage?.setItem('custom_max_tokens', settings.maxTokens);
        } else {
          localStorage?.removeItem('custom_max_tokens');
        }
      }

      setTestResult({ success: true, message: 'AI settings saved successfully!' });

      // Close after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save API key' });
    }
  };

  const clearAllSettings = async () => {
    try {
      // Clear all API keys and models
      localStorage?.removeItem('openai_api_key');
      localStorage?.removeItem('anthropic_api_key');
      localStorage?.removeItem('gemini_api_key');
      localStorage?.removeItem('custom_api_key');
      localStorage?.removeItem('custom_base_url');
      localStorage?.removeItem('custom_max_tokens');
      localStorage?.removeItem('openai_model');
      localStorage?.removeItem('anthropic_model');
      localStorage?.removeItem('gemini_model');
      localStorage?.removeItem('custom_model');

      // Reset form
      setSettings({
        provider: '',
        apiKey: '',
        baseUrl: '',
        model: '',
        maxTokens: ''
      });

      setTestResult({ success: true, message: 'All API settings cleared successfully!' });

      // Close after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to clear settings' });
    }
  };

  const testConnection = async () => {
    if (!settings.provider) {
      setTestResult({ success: false, message: 'Please select a provider first' });
      return;
    }

    // Custom provider: baseUrl required, API key optional
    if (settings.provider === 'custom' && !settings.baseUrl?.trim()) {
      setTestResult({ success: false, message: 'Please enter a base URL for custom endpoint' });
      return;
    }

    // Non-custom providers: API key required
    if (settings.provider !== 'custom' && !settings.apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { LLMService } = await import('../services/llmService');
      const serviceConfig = {
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model || undefined,
        baseUrl: settings.baseUrl || undefined,
        maxTokens: settings.maxTokens ? parseInt(settings.maxTokens, 10) : undefined
      };
      const service = new LLMService(serviceConfig);

      await service.generateYAML('Create a simple test entity with id TestEntity, category BACKEND, description "Test", status healthy, owner test-team, environment production');

      setTestResult({ success: true, message: 'Connection successful! ✅' });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'openai':
        return {
          name: 'OpenAI',
          description: 'GPT-4o, GPT-4o-mini models',
          defaultModel: 'gpt-4o-mini',
          keyUrl: 'https://platform.openai.com/api-keys'
        };
      case 'anthropic':
        return {
          name: 'Anthropic',
          description: 'Claude 3 models',
          defaultModel: 'claude-3-haiku-20240307',
          keyUrl: 'https://console.anthropic.com/settings/keys'
        };
      case 'gemini':
        return {
          name: 'Google Gemini',
          description: 'Gemini 1.5 Flash, Pro models',
          defaultModel: 'gemini-1.5-flash',
          keyUrl: 'https://aistudio.google.com/app/apikey'
        };
      case 'custom':
        return {
          name: 'Custom Endpoint',
          description: 'OpenAI-compatible API (e.g., Ollama, vLLM, local servers)',
          defaultModel: '',
          keyUrl: ''
        };
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 20 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          backgroundColor: '#ffffff',
          padding: 16,
          borderRadius: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}>
          <Text style={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}>
            {settings.provider ? '⚙️ Manage AI Settings' : '🔐 Configure AI API'}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
            <Text style={{ color: '#ef4444', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {/* Provider Selection */}
          <View style={{
            marginBottom: 20,
            backgroundColor: '#ffffff',
            padding: 16,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}>
            <Text style={{ color: '#1e293b', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
              Choose AI Provider:
            </Text>

            {['openai', 'anthropic', 'gemini', 'custom'].map((provider) => {
              const info = getProviderInfo(provider);
              return (
                <TouchableOpacity
                  key={provider}
                  onPress={() => setSettings(prev => ({
                    ...prev,
                    provider: provider as any,
                    model: info?.defaultModel || ''
                  }))}
                  style={{
                    backgroundColor: settings.provider === provider ? '#dbeafe' : '#f8fafc',
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 10,
                    borderWidth: 2,
                    borderColor: settings.provider === provider ? '#3b82f6' : '#e5e7eb'
                  }}
                >
                  <Text style={{
                    color: settings.provider === provider ? '#1e40af' : '#1e293b',
                    fontSize: 16,
                    fontWeight: 'bold',
                    marginBottom: 5
                  }}>
                    {info?.name}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14 }}>
                    {info?.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Base URL Input (Custom Endpoint) */}
          {settings.provider === 'custom' && (
            <View style={{
              marginBottom: 20,
              backgroundColor: '#ffffff',
              padding: 16,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ color: '#1e293b', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
                Base URL:
              </Text>
              <TextInput
                value={settings.baseUrl}
                onChangeText={(text) => setSettings(prev => ({ ...prev, baseUrl: text }))}
                placeholder="http://localhost:8000"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  padding: 15,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  fontSize: 16,
                  fontFamily: 'monospace'
                }}
              />
              <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
                Enter the base URL without path suffix (e.g. http://localhost:8000). The app will append /v1/models and /v1/chat/completions automatically.
              </Text>
            </View>
          )}

          {/* API Key Input */}
          {settings.provider && (
            <View style={{
              marginBottom: 20,
              backgroundColor: '#ffffff',
              padding: 16,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ color: '#1e293b', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
                API Key:{settings.provider === 'custom' ? ' (Optional):' : ':'}
              </Text>
              <TextInput
                value={settings.apiKey}
                onChangeText={(text) => setSettings(prev => ({ ...prev, apiKey: text }))}
                placeholder={`Enter your ${getProviderInfo(settings.provider)?.name} API key`}
                placeholderTextColor="#9ca3af"
                secureTextEntry={settings.provider !== 'custom'}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  padding: 15,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  fontSize: 16,
                  fontFamily: 'monospace'
                }}
              />

              {settings.provider !== 'custom' && (
                <TouchableOpacity
                  onPress={() => {
                    const info = getProviderInfo(settings.provider);
                    if (info?.keyUrl) {
                      // On web, open in new tab. On mobile, we'd need Linking
                      window?.open(info.keyUrl, '_blank');
                    }
                  }}
                  style={{ marginTop: 10 }}
                >
                  <Text style={{ color: '#3b82f6', fontSize: 14, textDecorationLine: 'underline' }}>
                    Get your API key from {getProviderInfo(settings.provider)?.name} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Model Selection */}
          {settings.provider && (
            <View style={{
              marginBottom: 20,
              backgroundColor: '#ffffff',
              padding: 16,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ color: '#1e293b', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
                Model:
              </Text>

              {settings.provider === 'custom' && discoveredModels.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {discoveredModels.map((model) => (
                    <TouchableOpacity
                      key={model.id}
                      onPress={() => setSettings(prev => ({ ...prev, model: model.id }))}
                      style={{
                        backgroundColor: settings.model === model.id ? '#3b82f6' : '#f1f5f9',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        marginRight: 8,
                        borderWidth: settings.model === model.id ? 2 : 1,
                        borderColor: settings.model === model.id ? '#3b82f6' : '#e2e8f0'
                      }}
                    >
                      <Text style={{
                        color: settings.model === model.id ? '#ffffff' : '#475569',
                        fontSize: 13,
                        fontWeight: '500',
                        maxWidth: 200,
                        flexShrink: 1
                      }}>
                        {model.id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {settings.provider === 'custom' && discoveredModels.length === 0 && (
                <Text style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>
                  {isDiscoveringModels ? 'Discovering models...' : settings.model ? 'Model selected' : 'No models discovered yet'}
                </Text>
              )}

              <TextInput
                value={settings.model}
                onChangeText={(text) => setSettings(prev => ({ ...prev, model: text }))}
                placeholder={settings.provider === 'custom'
                  ? 'e.g., Qwen/Qwen3.6-35B-A3B-FP8'
                  : `Default: ${getProviderInfo(settings.provider)?.defaultModel}`
                }
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  padding: 15,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  fontSize: 16,
                  fontFamily: 'monospace'
                }}
              />

              {settings.provider !== 'custom' && discoveredModels.length > 0 && (
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
                  Using default model or manually specify above
                </Text>
              )}
            </View>
          )}

          {/* Max Tokens (Custom Endpoint Only) */}
          {settings.provider === 'custom' && (
            <View style={{
              marginBottom: 20,
              backgroundColor: '#ffffff',
              padding: 16,
              borderRadius: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ color: '#1e293b', fontSize: 16, marginBottom: 10, fontWeight: 'bold' }}>
                Max Output Tokens (Optional):
              </Text>
              <TextInput
                value={settings.maxTokens}
                onChangeText={(text) => setSettings(prev => ({ ...prev, maxTokens: text.replace(/\D/g, '') }))}
                placeholder="Leave empty for server default"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  padding: 15,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  fontSize: 16,
                  fontFamily: 'monospace'
                }}
              />
              <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
                Limit the output tokens. Leave empty to let the server use the model's default.
              </Text>
            </View>
          )}

          {/* Test Result */}
          {testResult && (
            <View style={{
              backgroundColor: testResult.success ? '#d1fae5' : '#fee2e2',
              borderColor: testResult.success ? '#10b981' : '#ef4444',
              borderWidth: 1,
              padding: 15,
              borderRadius: 8,
              marginBottom: 20
            }}>
              <Text style={{ color: testResult.success ? '#065f46' : '#7f1d1d', fontSize: 16 }}>
                {testResult.message}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={testConnection}
              disabled={!settings.provider ||
                        (settings.provider !== 'custom' && !settings.apiKey) ||
                        (settings.provider === 'custom' && !settings.baseUrl) ||
                        isTesting}
              style={{
                flex: 1,
                backgroundColor: settings.provider &&
                  !(settings.provider !== 'custom' && !settings.apiKey) &&
                  !(settings.provider === 'custom' && !settings.baseUrl) &&
                  !isTesting ? '#f59e0b' : '#d1d5db',
                padding: 15,
                borderRadius: 8,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                {isTesting ? '🧪 Testing...' : '🧪 Test Connection'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={saveSettings}
              disabled={!settings.provider ||
                        (settings.provider !== 'custom' && !settings.apiKey) ||
                        (settings.provider === 'custom' && !settings.baseUrl)}
              style={{
                flex: 1,
                backgroundColor: settings.provider &&
                  !(settings.provider !== 'custom' && !settings.apiKey) &&
                  !(settings.provider === 'custom' && !settings.baseUrl) ? '#10b981' : '#d1d5db',
                padding: 15,
                borderRadius: 8,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                💾 Save & Close
              </Text>
            </TouchableOpacity>
          </View>

          {/* Clear Settings Button */}
          {(settings.provider || settings.apiKey) && (
            <TouchableOpacity
              onPress={clearAllSettings}
              style={{
                backgroundColor: '#fee2e2',
                borderColor: '#ef4444',
                borderWidth: 1,
                padding: 15,
                borderRadius: 8,
                alignItems: 'center',
                marginBottom: 20
              }}
            >
              <Text style={{ color: '#dc2626', fontSize: 16, fontWeight: 'bold' }}>
                🗑️ Clear All API Settings
              </Text>
            </TouchableOpacity>
          )}

          {/* Information */}
          <View style={{
            backgroundColor: '#ffffff',
            padding: 15,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}>
            <Text style={{ color: '#1e40af', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
              ℹ️ Privacy & Security
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
              • API keys are stored locally on your device{'\n'}
              • No keys are sent to Gorph servers{'\n'}
              • Direct communication with your chosen AI provider{'\n'}
              • You can delete keys anytime from browser storage
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default APIKeyConfig;