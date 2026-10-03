import { S } from './store';
import { dte } from './util';
const MONTHS = { th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const DOWS = { th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
/** L(thai, english): pick the string for the active language */
export const L = (th, en) => (S.lang === 'en' ? en : th);
export const fmtDate = s => { const d = dte(s); return d.getUTCDate() + ' ' + MONTHS[S.lang][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
export const fmtShort = s => { const d = dte(s); return d.getUTCDate() + ' ' + MONTHS[S.lang][d.getUTCMonth()]; };
export const dowName = i => DOWS[S.lang][i];
