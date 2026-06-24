// Derive a stable app identity from a Privy user object.
// id = 'privy:'+user.id (stable). label = email, else wallet short, else social handle.
// short = first part of the label.
export function deriveIdentity(user) {
  if (!user) return null;
  const id = 'privy:' + user.id;

  // email
  const email = user.email?.address
    || user.google?.email
    || user.linkedAccounts?.find((a) => a.type === 'email')?.address
    || null;

  // linked wallet
  const wallet = user.wallet?.address
    || user.linkedAccounts?.find((a) => a.type === 'wallet')?.address
    || null;

  // social handle
  const social = user.twitter?.username
    || user.google?.name
    || user.apple?.email
    || user.linkedAccounts?.find((a) => a.type === 'twitter_oauth')?.username
    || null;

  let label, short, type;
  if (email) {
    label = email; short = email.split('@')[0]; type = 'email';
  } else if (wallet) {
    const w = wallet.toLowerCase();
    label = w.slice(0, 6) + '…' + w.slice(-4); short = label; type = 'wallet';
  } else if (social) {
    label = social; short = String(social).split(/[\s@]/)[0] || social; type = 'social';
  } else {
    label = id.slice(0, 12); short = label; type = 'privy';
  }

  // Banter "verified email" gate: any authenticated Privy user that HAS an email.
  // (Privy verifies email ownership at login, so an authenticated user with an
  //  email is treated as a verified account.)
  const verifiedEmail = !!email;

  return { id, label, short, type, email, wallet, social, verifiedEmail };
}
