import { TokenEstimator } from '../tokenEstimator';
import { AIProviderManager } from './aiProviderManager';
import { AIResponseParser } from './aiResponseParser';
import { EvaluationRequest, EvaluationResponse } from './types';

export class AIEvaluationService {
  // Check if any API keys are available
  static hasApiKeys(): { gemini: boolean } {
    return { gemini: AIProviderManager.hasApiKeys().gemini };
  }

  // Force a specific provider for testing or debugging
  static forceProvider(provider: 'gemini' | 'auto' | null) {
    AIProviderManager.forceProvider(provider);
  }

  // New method for generating raw content (not evaluation-specific)
  static async generateContentWithBestAvailable(prompt: string): Promise<string> {
    const availableKeys = this.hasApiKeys();
    
    console.log('🔑 Available API keys for content generation:', availableKeys);
    console.log('🚫 Failed providers:', Array.from(AIProviderManager.getFailedProviders()));
    
    // Only use Gemini provider
    const providerPriority: Array<{ name: 'gemini', available: boolean }> = [
      { name: 'gemini', available: availableKeys.gemini && AIProviderManager.isProviderAvailable('gemini') }
    ];
    
    const availableProviders = providerPriority.filter(p => p.available);
    
    console.log('✅ Available providers for content generation:', availableProviders.map(p => p.name));
    
    if (availableProviders.length === 0) {
      throw new Error('No AI providers available. Please check your API keys configuration.');
    }
    
    // Try each available provider in order
    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i];
      const remainingProviders = availableProviders.slice(i + 1).map(p => p.name);
      
      try {
        console.log(`🚀 Trying ${provider.name} for content generation (${i + 1}/${availableProviders.length})`);
        
        const content = await AIProviderManager.generateRawText(prompt, provider.name);
        console.log(`✅ Successfully generated content with ${provider.name}`);
        return content;
      } catch (error: any) {
        console.warn(`⚠️ ${provider.name} failed for content generation:`, error.message);
        
        // Show warning popup if this provider hit limits
        if (error.limitInfo) {
          AIProviderManager.showLimitWarning(error.limitInfo, remainingProviders);
        }
        
        // If this is the last provider, throw the error
        if (i === availableProviders.length - 1) {
          throw new Error(`All AI providers failed. Last error: ${error.message}`);
        }
        
        // Continue to next provider
        continue;
      }
    }
    
    throw new Error('All AI providers failed for content generation.');
  }

  // Auto-select best available AI service with intelligent switching
  static async evaluateWithBestAvailable(request: EvaluationRequest): Promise<EvaluationResponse> {
    const availableKeys = this.hasApiKeys();
    
    console.log('🔑 Available API keys:', availableKeys);
    console.log('📊 Rating mode:', request.ratingMode || 'lenient');
    console.log('📊 Evaluation type:', request.evaluationType || 'simple');
    console.log('🚫 Failed providers:', Array.from(AIProviderManager.getFailedProviders()));
    
    // Only use Gemini provider
    const providerPriority: Array<{ name: 'gemini', available: boolean }> = [
      { name: 'gemini', available: availableKeys.gemini && AIProviderManager.isProviderAvailable('gemini') }
    ];
    
    // Only Gemini is available, no need for provider selection logic
    
    const availableProviders = providerPriority.filter(p => p.available);
    
    console.log('✅ Available providers in priority order:', availableProviders.map(p => p.name));
    
    if (availableProviders.length === 0) {
      console.log('❌ No AI providers available');
      throw new Error('No AI providers available. Please add API keys from Groq, OpenAI, or Gemini in Settings.');
    }
    
    // Try each available provider in order
    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i];
      const remainingProviders = availableProviders.slice(i + 1).map(p => p.name);
      
      try {
        console.log(`🚀 Trying ${provider.name} (${i + 1}/${availableProviders.length})`);
        
        switch (provider.name) {
          case 'groq':
            return await AIProviderManager.evaluateWithGroq(request);
          case 'openai':
            return await AIProviderManager.evaluateWithOpenAI(request);
          case 'gemini':
            return await AIProviderManager.evaluateWithGemini(request);
        }
      } catch (error: any) {
        console.warn(`⚠️ ${provider.name} failed:`, error.message);
        
        // Show warning popup if this provider hit limits
        if (error.limitInfo) {
          AIProviderManager.showLimitWarning(error.limitInfo, remainingProviders);
        }
        
        // If this is the last provider, throw the error
        if (i === availableProviders.length - 1) {
          console.log('❌ All providers failed');
          throw new Error(`All AI providers failed. Last error: ${error.message}`);
        }
        
        // Continue to next provider
        continue;
      }
    }
    
    // This should never be reached, but just in case
    throw new Error('Unexpected error: No AI providers available');
  }

  // Get status of all providers
  static getProviderStatus(): { 
    groq: { available: boolean; hasKey: boolean; failed: boolean }; 
    openai: { available: boolean; hasKey: boolean; failed: boolean }; 
    gemini: { available: boolean; hasKey: boolean; failed: boolean }; 
  } {
    return AIProviderManager.getProviderStatus();
  }

  // Reset failed providers (for manual retry)
  static resetFailedProviders(): void {
    AIProviderManager.resetFailedProviders();
  }
}