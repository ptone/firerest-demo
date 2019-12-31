<script lang="ts">
  import Menu, {SelectionGroup, SelectionGroupIcon} from '@smui/menu';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';
  import AppHeader from "./_components/AppHeader.svelte";
  import AppNav from "./_components/AppNav.svelte";
  import Profile from "./_components/Profile.svelte";
  import { navOpen } from "../navstate-store";


  import { user } from "../authstore"
  // import { url } from '@sveltech/routify'

  export let name: string;

  // let testurl = $url("/test");
  let testurl = "foo";
  // console.log(url);
  // console.log(url.subscribe);
  // console.log(url.subscribe("foo"));


</script>

<AppHeader name={name} />


<AppNav />


<main class="main-content mdc-drawer-app-content">
  <div class="mdc-top-app-bar--fixed-adjust ">
  {#if $user}
  <p>user: {$user.uid} </p>
{:else}
  <p>not logged in</p>
{/if}
<p>{ $navOpen }</p>
  <slot />
</main>