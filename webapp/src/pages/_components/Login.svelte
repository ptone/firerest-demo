<script>

  import { fireAuth, signIn } from '../../firebase';
  // import { authState } from 'rxfire/auth';
  import List, {Item, Separator, Text, PrimaryText, SecondaryText, Graphic} from '@smui/list';

  // let user;

  import { user } from '../../authstore'

  // const unsubscribe = authState(fireAuth).subscribe(u => user = u);

</script>



{#if $user}
    <!-- <Profile {...user} /> -->
    <Item on:click={ () => fireAuth.signOut() } >
      <Text>Logout</Text>
    </Item>
{:else}
  <Item on:click={ () => signIn() } >
      <Text>Signin with Google</Text>
  </Item>
{/if}
