import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import Stack from '@mui/material/Stack';
import axios from 'axios';
import { Container, Typography } from '@mui/material/';
import AppBar from '@mui/material/AppBar';
import CameraIcon from '@mui/icons-material/PhotoCamera';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LinearProgress from '@mui/material/LinearProgress';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import queryString from 'query-string';

const theme = createTheme();
export default function App() {

  const [dailymotionState, setToken] = React.useState(localStorage.getItem('token'))
  const [showLoading, setShowLoading] = React.useState(true)
  const [channelid, setChannelId] = React.useState(localStorage.getItem('channelid'))
  const [title, setTitle] = React.useState('')
  const [forKids, setForKids] = React.useState(true)
  const [published, setPublished] = React.useState(true)
  const [category, setCategory] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [tags, setTags] = React.useState([])

  React.useEffect(() => {
    if (!showLoading) {
      document.body.style.opacity = 0.5;
    } else {
      document.body.style.opacity = 1;
    }
  }, [showLoading])

  React.useEffect(() => {
    // Extract the authorization code from the URL query parameters
    const parsed = queryString.parse(window.location.search);
    const code = parsed.code;

    if (code) {
      // Make a request to the Dailymotion API to exchange the authorization code for an access token
      const params = {
        grant_type: 'authorization_code',
        client_id: '',
        client_secret: '',
        redirect_uri: '',
        code: code
      };

      axios.post('https://api.dailymotion.com/oauth/token', params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      })
        .then(response => {
          console.log(response.data.access_token)
          localStorage.setItem('token', response.data.access_token)
        })
        .catch(error => {
          toast('Something went wrong while authenticating!')
        });
    }
  }, []);

  const onChangeHandler = event => {
    setShowLoading(false)
    event.preventDefault()
    const file = event.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    axios.post('http://107.23.58.228/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'responseType': 'blob'
      }
    }).then(res => {
      axios.post('http://107.23.58.228/content_moderation', { 'url': res }, {
      }).then(response => {
        var config = response.config.data
        const responseObj = JSON.parse(config);
        const s3Url = responseObj.url.data;
        dailymotionUpload(s3Url)
        const url = URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'subtitles.srt')
        document.body.appendChild(link)
        link.click()
        toast("Video upload was succesful!")
        setShowLoading(true)
      }).catch(error => {
        toast(error.response.data)
        setShowLoading(true)
      })
    }).catch(error => {
      toast(error.response.data)
      setShowLoading(true)
    })
  }

  const setChannel = (event) => {
    event.preventDefault()
    var text = localStorage.getItem('channelid')
    if (!text) {
      localStorage.setItem('channelid', channelid)
    }
    setChannelId(text)
  }

  const onChangeChannel = (event) => {
    setChannelId(event.target.value)
  }

  const onTitleChange = (event) => {
    setTitle(event.target.value)
  }

  const onPublishedChange = (event) => {
    setPublished(event.target.checked)
  }

  const onCreatedForKidsChange = (event) => {
    setForKids(event.target.checked)
  }

  const onCategoryChange = (event) => {
    setCategory(event.target.value);
  };

  const getTags = (event) => {
    setShowLoading(false)
    axios.post('http://107.23.58.228/get_tags', {'data': url}, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(res => {
      setShowLoading(true)
      setTags(res.data.tags)
    }).catch(error => {
      toast(error.response.data)
    })
    
  }

  const dailymotionUpload = (url) => {
    setUrl(url)
    var data = {
      'url': url,
      'title': title,
      'channel': category,
      'published': published,
      'is_created_for_kids': forKids
    };
    var config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://api.dailymotion.com/user/' + channelid + '/videos',
      headers: {
        'Authorization': 'Bearer ',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: data
    };
    axios(config)
      .then(function (response) {
        toast('Video upload success')
      })
      .catch(function (error) {
        toast('Something went wrong! Try again')
      });

  }

  return (
    <div>
      <Box sx={{ width: '100%' }}>
        <LinearProgress style={{ 'display': showLoading ? 'none' : 'block' }} />
      </Box>
      <ToastContainer />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppBar position="relative">
          <Toolbar>
            <CameraIcon sx={{ mr: 2 }} />
            <Typography variant="h6" color="inherit" noWrap>
              Upload videos
            </Typography>
          </Toolbar>
        </AppBar>

        <main>
          {/* Hero unit */}
          <Box
            sx={{
              bgcolor: 'background.paper',
              pt: 8,
              pb: 6,
            }}
          >
            <Container maxWidth="sm">
              <Typography
                component="h1"
                variant="h2"
                align="center"
                color="text.primary"
                gutterBottom
              >
                Video upload
              </Typography>
              <Typography variant="h5" align="center" color="text.secondary" paragraph>
                Upload videos, first login
              </Typography>
              <div>
                <h1>Dailymotion Authentication</h1>
                <p>Click the button below to authorize this app to access your Dailymotion account.</p>
                <a style={{ margin: '0 auto' }} href="https://www.dailymotion.com/oauth/authorize?response_type=code&grant_type=authorization_code&client_id=&redirect_uri=&scope=read+write">Authorize</a>

              </div>
              <hr />
              <form onSubmit={setChannel}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  Enter your channel:
                  <TextField value={channelid} onChange={onChangeChannel} required />
                  Title:
                  <TextField onChange={onTitleChange} required />
                  For Kids?:
                  <Checkbox checked={forKids} onChange={onCreatedForKidsChange} />
                  Published:
                  <Checkbox checked={published} onChange={onPublishedChange} />
                  <FormControl fullWidth>
                    <InputLabel id="select-label">Category</InputLabel>
                    <Select
                      labelId="select-label"
                      id="simple-select"
                      value={category}
                      label="Category"
                      onChange={onCategoryChange}
                      required
                    >
                      <MenuItem value='animals'>Animals</MenuItem>
                      <MenuItem value='creation'>Creative</MenuItem>
                      <MenuItem value='auto'>Cars</MenuItem>
                      <MenuItem value='school'>Education</MenuItem>
                      <MenuItem value='people'>Celeb</MenuItem>
                      <MenuItem value='fun'>Comedy & Entertainment</MenuItem>
                      <MenuItem value='videogames'>Gaming</MenuItem>
                      <MenuItem value='tech'>Tech</MenuItem>
                      <MenuItem value='kids'>Kids</MenuItem>
                      <MenuItem value='shortfilms'>Movies</MenuItem>
                      <MenuItem value='music'>Music</MenuItem>
                    </Select>
                  </FormControl>
                  <Button style={{ marginTop: '25px' }} variant="contained">Save</Button>
                </div>
              </form>
              <hr />
              <Stack
                sx={{ pt: 4 }}
                direction="row"
                spacing={2}
                justifyContent="center"
              >
                <Typography variant="h6" align="center" color="text.secondary" paragraph>
                  Upload
                  <IconButton position="relative" color="primary" disabled={!showLoading} aria-label="upload picture" component="label">
                    <input onChange={onChangeHandler} hidden accept="video/mp4,video/x-m4v,video/*" type="file" />
                    <VideoCameraFrontIcon fontSize='large' />
                  </IconButton>
                </Typography>
              </Stack>
              <Button onClick={getTags}>Get tags</Button>
              {tags.length > 0 ?
                tags.map((tag) => <p>#{tag},</p>)
              : ""}
            </Container>
          </Box>
        </main>
      </ThemeProvider>
    </div>
  );
}
