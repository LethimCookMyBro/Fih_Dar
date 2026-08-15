'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';

import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { navGroups } from '@/config/nav-config';

function BrandMark() {
  return (
    <div className='bg-primary text-primary-foreground flex size-(--brand-mark) shrink-0 items-center justify-center rounded-lg'>
      <Icons.radar className='size-(--nav-icon-lg)' aria-hidden />
    </div>
  );
}

/**
 * Tablet portrait (768–1023px) is the width where an expanded 288px sidebar
 * costs too much: on iPad portrait it leaves the map only ~61% of the viewport.
 * Collapse to the 72px rail there so content keeps ~91%.
 *
 * Deliberately one-directional — it never auto-expands. Forcing the sidebar back
 * open at >=1024 would override a desktop user who chose to collapse it, and the
 * rail is the safer default of the two.
 */
function useCollapseOnTablet() {
  const { setOpen } = useSidebar();

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023.98px)');
    const apply = () => {
      if (mql.matches) setOpen(false);
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [setOpen]);
}

export function FihDarSidebar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const { setOpenMobile } = useSidebar();
  const items = navGroups.flatMap((group) => group.items);

  useCollapseOnTablet();

  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              tooltip='FihDar'
              render={<Link href='/map' aria-label='FihDar' onClick={closeMobile} />}
            >
              <BrandMark />
              <div className='grid text-start leading-tight'>
                {/* Reference wordmark: 20px / 600. */}
                <span className='truncate text-xl leading-tight font-semibold tracking-tight'>
                  FihDar
                </span>
                <span className='text-muted-foreground truncate text-[0.8125rem]'>
                  Fish + Radar
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => {
              const Icon = item.icon ? Icons[item.icon] : Icons.circle;
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                    render={<Link href={item.url} aria-label={item.title} onClick={closeMobile} />}
                  >
                    <Icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isLoaded && isSignedIn && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size='lg'
                  tooltip='โปรไฟล์'
                  isActive={pathname === '/profile'}
                  render={<Link href='/profile' aria-label='โปรไฟล์' onClick={closeMobile} />}
                >
                  <Avatar className='size-(--brand-mark) rounded-full'>
                    <AvatarImage src={user?.imageUrl} alt='' />
                    <AvatarFallback className='rounded-full'>
                      <Icons.user className='size-(--nav-icon)' aria-hidden />
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid min-w-0 text-start leading-tight'>
                    <span className='truncate text-[0.9375rem] font-medium'>
                      {user?.fullName ?? 'โปรไฟล์'}
                    </span>
                    <span className='text-muted-foreground truncate text-[0.8125rem]'>
                      {user?.primaryEmailAddress?.emailAddress ?? ''}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  // Destructive-adjacent and secondary to the primary nav, so it
                  // sits a step down in contrast rather than competing with it.
                  className='text-muted-foreground hover:text-destructive font-normal'
                  tooltip='ออกจากระบบ'
                  onClick={() => {
                    closeMobile();
                    void signOut({ redirectUrl: '/map' });
                  }}
                >
                  <Icons.logout />
                  <span>ออกจากระบบ</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
          {isLoaded && !isSignedIn && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip='เข้าสู่ระบบ'
                render={
                  <Link
                    href='/auth/sign-in?redirect_url=/profile'
                    aria-label='เข้าสู่ระบบ'
                    onClick={closeMobile}
                  />
                }
              >
                <Icons.login />
                <span>เข้าสู่ระบบ</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
