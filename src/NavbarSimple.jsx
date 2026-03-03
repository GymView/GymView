import { useState } from 'react';
import {
  IconMap,
  IconTool,
  IconLogout,
  IconLayoutDashboard,
  IconSwitchHorizontal,
} from '@tabler/icons-react';
import { Code, Group } from '@mantine/core';
import { MantineLogo } from '@mantinex/mantine-logo';
import classes from './NavbarSimple.module.css';

const data = [
  { link: '', label: 'Carte', icon: IconMap },
  { link: '', label: 'Dashboard', icon: IconLayoutDashboard },
  { link: '', label: 'Maintenance', icon: IconTool },
];

export function NavbarSimple() {
  const [active, setActive] = useState('Billing');

  const links = data.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href={item.link}
      key={item.label}
      onClick={(event) => {
        event.preventDefault();
        setActive(item.label);
      }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>{item.label}</span>
    </a>
  ));

  return (
    <nav className={classes.navbar}>
        <br />
      <div className={classes.navbarMain}>
        <Group className={classes.header} justify="space-between">
          <MantineLogo size={28} />
          <Code fw={700}>v3.1.2</Code>
        </Group>
        <br />
        {links}
      </div>

      <div className={classes.footer}>
        <a href="#" className={classes.link} onClick={(event) => event.preventDefault()}>
          <IconSwitchHorizontal className={classes.linkIcon} stroke={1.5} />
          <span>Change account</span>
        </a>

        <a href="#" className={classes.link} onClick={(event) => event.preventDefault()}>
          <IconLogout className={classes.linkIcon} stroke={1.5} />
          <span>Logout</span>
        </a>
      </div>
    </nav>
  );
}