import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div
      style={{
        background: '#0A1424',
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(0,200,214,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(201,169,97,0.06), transparent 60%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#C9A961',
            colorBackground: '#11203A',
            colorText: '#F0E6D2',
            colorTextSecondary: 'rgba(240,230,210,0.66)',
            colorInputBackground: 'rgba(240,230,210,0.04)',
            colorInputText: '#F0E6D2',
            colorDanger: '#A53241',
            colorSuccess: '#10A86A',
            borderRadius: '8px',
            fontFamily: '"Satoshi", "Inter", system-ui, sans-serif',
          },
        }}
        redirectUrl="/dashboard"
      />
    </div>
  );
}
