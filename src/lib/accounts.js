import { S } from './store';
export const ROLES = { owner: ['เจ้าของร้าน', 'Store owner'], manager: ['ผู้จัดการสต๊อก', 'Inventory manager'], buyer: ['เจ้าหน้าที่จัดซื้อ', 'Purchasing officer'] };
// demo mode only (no SHEET_URL); with Google Sheets the accounts live in the "8. Users" tab
export const ACCOUNTS = [
  { u: 'owner', p: 'owner123', name: 'คุณณภัทร', nameEn: 'Khun Napat', role: 'owner' },
  { u: 'manager', p: 'manager123', name: 'คุณพิม', nameEn: 'Khun Pim', role: 'manager' },
  { u: 'buyer', p: 'buyer123', name: 'คุณอาร์ม', nameEn: 'Khun Arm', role: 'buyer' },
];
/** the signed-in person with display labels; roleKey is owner | manager | buyer */
export const userOf = () => {
  const a = S.user, r = a && ROLES[a.role];
  return r ? { ...a, nameEn: a.nameEn || a.name, roleKey: a.role, role: r[0], roleEn: r[1] } : null;
};
