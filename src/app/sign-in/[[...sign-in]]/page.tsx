import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <SignIn
        forceRedirectUrl="/candidates"
        signUpUrl="/sign-up"
        appearance={{
          variables: { colorPrimary: "#0f6e67" },
          layout: { socialButtonsVariant: "blockButton" },
        }}
      />
    </div>
  );
}
