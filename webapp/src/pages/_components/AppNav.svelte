<script lang="ts">

  import { isActive, url } from '@sveltech/routify';
  
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import Drawer, {AppContent, Content, Header, Subtitle, Scrim, Title } from '@smui/drawer';
  let myDrawer;
  let myDrawerOpen = false;

  let active = 'Gray Kittens';
  import { navOpen } from "../../navstate-store";
  import { user } from "../../authstore";

// ideally this could be in the component
// but when I try context=module for the script getting: https://gist.github.com/ptone/6f6c3c14b98635daf0c01870120a2e40
  // const navOpen = writable(false);
  // export { navOpen };

  const links = [
    ['./index', 'Home'],
    ['./test', 'Testing'],
    ['./cars', 'Cars']
  ];


 </script>

<Drawer class="mdc-top-app-bar--fixed-adjust" variant="dismissible" bind:this={myDrawer} bind:open={$navOpen}>
  <Header>
    <Title>Test Drawer</Title>
    <Subtitle>It's the best drawer.</Subtitle>
  </Header>
  <Content>
    <List>
    {#if $user}
      {#each links as [path, name]}
        <Item href={$url(path)} activated={$isActive(path)}>
          <Text>{name}</Text>
        </Item> 
      {/each}
    {/if}
    <Separator />
   

    </List>
  </Content>
</Drawer>