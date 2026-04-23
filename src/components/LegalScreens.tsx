import * as React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Shield, FileText } from 'lucide-react';

interface LegalScreenProps {
  onBack: () => void;
}

export function PrivacyPolicyScreen({ onBack }: LegalScreenProps) {
  return (
    <div className="max-w-3xl mx-auto px-8 py-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-apple-text-tertiary hover:text-white transition-colors mb-12"
      >
        <ChevronLeft size={20} />
        <span className="small-caps">Back</span>
      </button>

      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-teal w-6 h-6" />
        <h1 className="text-large-title font-bold">Privacy Policy</h1>
      </div>

      <div className="apple-card space-y-8 text-apple-text-secondary text-body leading-relaxed max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
        <section>
          <h2 className="text-white font-bold mb-4">1. Data Sovereignty</h2>
          <p>
            TaxBreaker is built on the principle of data sovereignty. You own your financial data. We do not sell, trade, or rent your personal identification information to others. 
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">2. File Access & Security</h2>
          <p>
            We only access files that you explicitly select and upload to the Secure Vault. We do not scan your device or background folders. All document processing is performed over encrypted channels.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">3. AI Processing</h2>
          <p>
            Your documents are processed by our intelligence engine to provide tax optimization strategies. This data is transient during analysis unless you choose to persist it in your encrypted vault.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">4. Compliance</h2>
          <p>
            TaxBreaker adheres to global data protection standards (GDPR, CCPA) to ensure your financial privacy is maintained at all times.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">5. Right to Erasure</h2>
          <p>
            You maintain the absolute right to purge your digital identity. By using the 'Purge' feature in your profile, all documents, input data, and optimization strategies will be permanently deleted from our servers and your local storage instantly.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4 text-caption uppercase tracking-widest">Last Updated: April 2026</h2>
        </section>
      </div>
    </div>
  );
}

export function TermsScreen({ onBack }: LegalScreenProps) {
  return (
    <div className="max-w-3xl mx-auto px-8 py-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-apple-text-tertiary hover:text-white transition-colors mb-12"
      >
        <ChevronLeft size={20} />
        <span className="small-caps">Back</span>
      </button>

      <div className="flex items-center gap-3 mb-8">
        <FileText className="text-teal w-6 h-6" />
        <h1 className="text-large-title font-bold">Terms of Use</h1>
      </div>

      <div className="apple-card space-y-8 text-apple-text-secondary text-body leading-relaxed max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
        <section>
          <h2 className="text-white font-bold mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing TaxBreaker, you agree to be bound by these Terms of Use and all applicable tax laws and regulations.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">2. Professional Advice Disclaimer</h2>
          <p>
            TaxBreaker provides AI-driven insights and strategies based on current tax law. However, these insights do not constitute formal legal or tax advice. We recommend consulting with a certified tax professional for critical filings.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">3. User Responsibility</h2>
          <p>
            You are responsible for the accuracy of the data you provide. Tax optimization outcomes are highly dependent on the precision of the input documentation.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4">4. Strategic Limits</h2>
          <p>
            Our simulation engine provides projections based on historical data and current algorithms. Future results may vary based on legislative changes.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold mb-4 text-caption uppercase tracking-widest">Version: 2.1.0-Lux</h2>
        </section>
      </div>
    </div>
  );
}
