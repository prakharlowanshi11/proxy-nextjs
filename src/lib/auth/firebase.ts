import { getFirebase } from "@/lib/firebase/loadFirebase";

export async function loginWithGooglePopup() {
  const firebase = await getFirebase();
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
  });
  try {
    await auth.signOut();
  } catch {
    // ignore sign out failures
  }
  const credential = await auth.signInWithPopup(provider);
  const idToken = await credential.user?.getIdToken();
  if (!idToken) {
    throw new Error("Unable to retrieve ID token from Google login");
  }
  return { idToken, user: credential.user };
}

export async function logoutFromFirebase() {
  const firebase = await getFirebase();
  await firebase.auth().signOut();
}
