import { createDraftPos } from '../lib/actions';
import { useRoute } from '../router';
import { useOverlay } from './ui';
import { L } from '../lib/i18n';

/** one click: build draft POs for these products and open the first one */
export function useOrderNow() {
  const { go } = useRoute(), { toast } = useOverlay();
  return skus => {
    const nos = createDraftPos(skus); if (!nos.length) return;
    go('po', nos[0]);
    toast(L(`สร้างร่างใบสั่งซื้อ ${nos.length} ใบแล้ว ตรวจสอบจำนวนก่อนส่งนะคะ`, `${nos.length} draft order${nos.length > 1 ? 's' : ''} created. Check quantities before sending.`));
  };
}
