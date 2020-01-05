<script lang="ts">
  import AppHeader from "./_components/AppHeader.svelte";
  import AppNav from "./_components/AppNav.svelte";
  import { signIn, getToken } from "../firebase";
  import { user } from "../authstore";

  export let scoped;
  console.log(scoped);
  export let name: string;
  let token: string = "pending";
  user.subscribe(u => {
    console.log("in sub");
    if (u) {
      u.getIdToken().then((t) => token = t)
    } else {
      console.log("null user");
      token = "pending new login";
    }
  });
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
    <p>{$user.uid}</p>
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
