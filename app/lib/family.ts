export type FamilyMember = {
  name: string;
  email: string;
  userId: string;
  path: string;
  color: string;
  initial: string;
};

export const FAMILY_MEMBERS: FamilyMember[] = [
  {
    name: 'Andrea',
    email: 'demya1981@gmail.com',
    userId: 'fd66cfc9-81e9-43fb-9998-14e3f5552c7d',
    path: 'andrea',
    color: 'bg-pink-500 shadow-pink-500/50',
    initial: 'A',
  },
  {
    name: 'Zsolt',
    email: 'stuller.zsolt@gmail.com',
    userId: '002ebc2c-1e6a-42d2-8d93-ecaab7678a64',
    path: 'zsolt',
    color: 'bg-blue-500 shadow-blue-500/50',
    initial: 'ZS',
  },
  {
    name: 'Adél',
    email: 'stuller.adel@gmail.com',
    userId: '6a2a9b24-09d2-4d03-a2f3-15cfec060d09',
    path: 'adel',
    color: 'bg-purple-500 shadow-purple-500/50',
    initial: 'A',
  },
  {
    name: 'Zsombor',
    email: 'stuller.zsombor@gmail.com',
    userId: '3f0d1cbf-c353-4df3-bec2-b9130c2112b0',
    path: 'zsombor',
    color: 'bg-orange-500 shadow-orange-500/50',
    initial: 'ZS',
  },
];

export const FAMILY_EMAIL_WHITELIST = FAMILY_MEMBERS.map((member) => member.email);

export function canonicalizeFamilyValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function memberNameEquals(left: string, right: string): boolean {
  return canonicalizeFamilyValue(left) === canonicalizeFamilyValue(right);
}

export function getFamilyDisplayName(email: string): string {
  return FAMILY_MEMBERS.find((member) => member.email === email)?.name || 'Családtag';
}

export function getUserIdsForOwner(ownerName?: string | null): string[] {
  if (!ownerName) {
    return FAMILY_MEMBERS.map((member) => member.userId);
  }

  return FAMILY_MEMBERS.filter((member) => memberNameEquals(member.name, ownerName)).map((member) => member.userId);
}
