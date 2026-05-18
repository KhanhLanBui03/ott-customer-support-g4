from gtts import gTTS
import os

os.makedirs('web/public/sounds', exist_ok=True)

gTTS(text='Thuê bao quý khách vừa gọi, hiện không liên lạc được. Xin quý khách vui lòng gọi lại sau.', lang='vi').save('web/public/sounds/unreachable.mp3')
gTTS(text='Người nghe hiện đang bận. Xin quý khách vui lòng gọi lại sau.', lang='vi').save('web/public/sounds/busy.mp3')
print('Audio files generated successfully!')
