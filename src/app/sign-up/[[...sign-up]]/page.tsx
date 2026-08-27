import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <SignUp
        forceRedirectUrl="/candidates"
        signInUrl="/sign-in"
        appearance={{
          variables: { colorPrimary: "#0f6e67" },
          layout: { socialButtonsVariant: "blockButton" },
        }}
      />
    </div>
  );
}
