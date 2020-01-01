<script lang="ts">
  import AppHeader from "./_components/AppHeader.svelte";
  import AppNav from "./_components/AppNav.svelte";
  import { signIn } from "../firebase";
  import { user } from "../authstore";

  export let name: string;
</script>

<style>
  .mdc-drawer-app-content {
    flex: auto;
    overflow: auto;
    position: relative;
  }

  .main-content {
    overflow: auto;
    height: 100%;
    padding-left: 10px;


  }

  img {
    margin: 0 auto;
    display: block;
  }
</style>

<AppHeader {name} />
<AppNav />

<div class="mdc-drawer-app-content mdc-top-app-bar--fixed-adjust">
  <main class="main-content ">

    {#if $user}
      <slot />
    {:else}
      <h3 class="mdc-typography--headline3">You must first login</h3>
      <img
        alt="login button"
        on:click={() => signIn()}
        src="./image/btn_google_signin_light_normal_web.png" />
    {/if}
  </main>
</div>
