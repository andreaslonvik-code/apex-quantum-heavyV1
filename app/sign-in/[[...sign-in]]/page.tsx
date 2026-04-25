import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div
      style={{ background: 'var(--aq-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#00F5FF',
            colorBackground: '#0A0A10',
            colorText: '#ffffff',
            colorInputBackground: 'rgba(255,255,255,0.05)',
            colorInputText: '#ffffff',
            borderRadius: '12px',
          },
          elements: {
            card: 'glass-hi',
            rootBox: 'w-full max-w-md',
          },
        }}
        redirectUrl="/dashboard"
      />
    </div>
  );
}
