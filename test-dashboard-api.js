const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im03YWkxbHRmbXVodHRheSIsImVtYWlsIjoidGVzdF8xNzQwMTU0MjQ4NDI5QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQwMTU0MjQ4LCJleHAiOjE3NDI3NDYyNDh9.p4P-G0NlV1WzP0c1dJt2M8tW-mB9GqT_gB1_w5p_I-c';
const urls = [
    'https://sarkar-hamari-4hny92405-nopes-projects-69f41d06.vercel.app/api/auth/me',
    'https://sarkar-hamari-4hny92405-nopes-projects-69f41d06.vercel.app/api/jobs',
    'https://sarkar-hamari-4hny92405-nopes-projects-69f41d06.vercel.app/api/jobs/eligible',
    'https://sarkar-hamari-4hny92405-nopes-projects-69f41d06.vercel.app/api/jobs/partial',
    'https://sarkar-hamari-4hny92405-nopes-projects-69f41d06.vercel.app/api/jobs/liked'
];

async function test() {
    for (const url of urls) {
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const text = await res.text();
            console.log(url, res.status, text.substring(0, 100));
        } catch (err) {
            console.error(url, err);
        }
    }
}
test();
