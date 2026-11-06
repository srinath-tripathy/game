//  Sharing works without a server: the score is stored inside the link itself,
//  e.g.  https://your-site.com/?from=Sam&hearts=42&time=30

//  Read a challenge from the current page's link, or return null if there isn't one
export function getChallenge ()
{
    const params = new URLSearchParams(window.location.search);
    const hearts = Number(params.get('hearts'));

    if (!params.has('hearts') || !Number.isFinite(hearts))
    {
        return null;
    }

    //  Links made before the time could be chosen were always 60 second rounds
    const time = Number(params.get('time'));

    return {
        name: (params.get('from') || 'Your partner').slice(0, 20),
        hearts: Math.max(0, Math.floor(hearts)),
        time: Number.isFinite(time) && time > 0 ? Math.floor(time) : 60
    };
}

export function makeShareLink (name, hearts, time)
{
    const url = new URL(window.location.origin + window.location.pathname);

    url.searchParams.set('from', name);
    url.searchParams.set('hearts', hearts);
    url.searchParams.set('time', time);

    return url.toString();
}

//  Use the phone's share sheet if there is one, otherwise copy the link
export async function shareResult (name, hearts, time)
{
    const link = makeShareLink(name, hearts, time);
    const text = `${name} caught ${hearts} hearts in ${time} seconds for you! Can you beat it?`;

    if (navigator.share)
    {
        try
        {
            await navigator.share({ title: 'Catch My Heart', text, url: link });
            return 'Shared!';
        }
        catch
        {
            return '';      //  the player closed the share sheet
        }
    }

    try
    {
        await navigator.clipboard.writeText(`${text} ${link}`);
        return 'Link copied! Send it to your partner.';
    }
    catch
    {
        window.prompt('Copy this link and send it to your partner:', link);
        return '';
    }
}
