import { NavGroup } from '@/types';

/**
 * FihDar navigation. Kept deliberately small — the product is a map first,
 * a reporting form second. The sidebar footer (profile / sign in / sign out)
 * is rendered separately by the shell, not from this list.
 */
export const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      {
        title: 'แผนที่',
        url: '/map',
        icon: 'map',
        shortcut: ['m', 'm'],
        items: []
      },
      {
        title: 'แจ้งการพบ',
        url: '/report',
        icon: 'mapPinPlus',
        shortcut: ['r', 'r'],
        items: []
      },
      {
        title: 'ศูนย์ปฏิบัติการ',
        url: '/ops',
        icon: 'target',
        items: [],
        // Officer-only: the page itself is server-guarded; this only hides the
        // nav entry for ordinary citizens.
        showIfOfficer: true
      },
      {
        title: 'แหล่งข้อมูล',
        url: '/sources',
        icon: 'database',
        items: []
      },
      {
        title: 'เกี่ยวกับ FihDar',
        url: '/about',
        icon: 'info',
        items: []
      }
    ]
  }
];
