import { useEffect, useState } from 'react';
import {
  IconHome,
  IconMap,
  IconTool,
  IconLogout,
  IconLayoutDashboard,
  IconSwitchHorizontal,
  IconMessage,
  IconEdit,
} from '@tabler/icons-react';
import { Code, Group } from '@mantine/core';
import classes from './NavbarSimple.module.css';
import myLogo from './assets/logo-v-zion.svg';

const data = [
  { link: '', label: 'Home', icon: IconHome },
  { link: '', label: 'Dashboard', icon: IconLayoutDashboard },
  { link: '', label: 'Maintenance', icon: IconTool },
  { link: '', label: 'Carte', icon: IconMap },
  { link: '', label: 'Messages', icon: IconMessage },
];

export function Navbar( { active, setActive } ) {
  //const [active, setActive] = useState('Home');
  

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
          <img 
            src={myLogo} 
            alt="Logo Gym" 
            style={{ height: 50, width: 'auto'}}
          />
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