use serde::Deserialize;
use std::io::Cursor;
use tauri::Webview;
use tauri_plugin_dialog::DialogExt;
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureBounds { x:f64, y:f64, width:f64, height:f64, viewport_width:f64, viewport_height:f64 }
#[derive(Clone,Deserialize)]
pub struct AppCaptureRegion {id:String,x:f64,y:f64,width:f64,height:f64}
impl AppCaptureRegion {
    fn validate(&self,bounds:&CaptureBounds)->Result<(),String>{
        if [self.x,self.y,self.width,self.height].iter().any(|v|!v.is_finite()) || self.width<1.0 || self.height<1.0
            || self.x<bounds.x-0.5 || self.y<bounds.y-0.5 || self.x+self.width>bounds.x+bounds.width+0.5 || self.y+self.height>bounds.y+bounds.height+0.5 {
            return Err("The browser is outside this widget's capture area.".into());
        }
        Ok(())
    }
}
impl CaptureBounds {
    fn validate(&self) -> Result<(), String> {
        if [self.x,self.y,self.width,self.height,self.viewport_width,self.viewport_height].iter().any(|v| !v.is_finite())
            || self.x<0.0 || self.y<0.0 || self.width<1.0 || self.height<1.0 || self.viewport_width<1.0 || self.viewport_height<1.0
            || self.viewport_width>20000.0 || self.viewport_height>20000.0
            || self.x+self.width>self.viewport_width+0.5 || self.y+self.height>self.viewport_height+0.5 {
            return Err("Bring the whole widget into view before capturing it.".into());
        }
        Ok(())
    }
}
fn crop(bytes:&[u8],bounds:&CaptureBounds) -> Result<image::RgbaImage,String> {
    bounds.validate()?;
    let frame=image::load_from_memory(bytes).map_err(|e|e.to_string())?;
    let sx=frame.width() as f64/bounds.viewport_width;
    let sy=frame.height() as f64/bounds.viewport_height;
    let x=(bounds.x*sx).round() as u32;let y=(bounds.y*sy).round() as u32;
    let width=((bounds.width*sx).round() as u32).min(frame.width().saturating_sub(x));
    let height=((bounds.height*sy).round() as u32).min(frame.height().saturating_sub(y));
    if width==0 || height==0 {return Err("This widget is outside the capture area.".into());}
    Ok(frame.crop_imm(x,y,width,height).to_rgba8())
}
fn compose(bytes:&[u8],bounds:&CaptureBounds,app_region:Option<(&AppCaptureRegion,&[u8])>)->Result<image::RgbaImage,String>{
    let mut result=crop(bytes,bounds)?;
    if let Some((region,png))=app_region {
        region.validate(bounds)?;
        let sx=result.width() as f64/bounds.width;let sy=result.height() as f64/bounds.height;
        let child=image::load_from_memory(png).map_err(|e|e.to_string())?.to_rgba8();
        let resized=image::imageops::resize(&child,(region.width*sx).round().max(1.0) as u32,(region.height*sy).round().max(1.0) as u32,image::imageops::FilterType::Triangle);
        image::imageops::overlay(&mut result,&resized,((region.x-bounds.x)*sx).round().max(0.0) as i64,((region.y-bounds.y)*sy).round().max(0.0) as i64);
    }
    Ok(result)
}

#[cfg(target_os="windows")]
async fn preview(webview:&Webview) -> Result<Vec<u8>,String> {
    use webview2_com::{CapturePreviewCompletedHandler, Microsoft::Web::WebView2::Win32::*};
    use windows::Win32::{UI::Shell::SHCreateMemStream,System::Com::{STATSTG,STATFLAG_NONAME,STREAM_SEEK_SET}};
    let (sender,receiver)=std::sync::mpsc::channel();
    webview.with_webview(move |platform| unsafe {
        let Some(stream)=SHCreateMemStream(None) else {let _=sender.send(Err("Unable to allocate image capture.".to_string()));return;};
        let completed_stream=stream.clone();let completed_sender=sender.clone();
        let handler=CapturePreviewCompletedHandler::create(Box::new(move |result| {
            let read=(||->Result<Vec<u8>,String>{
                result.map_err(|e|e.to_string())?;
                let mut stat=STATSTG::default();completed_stream.Stat(&mut stat,STATFLAG_NONAME).map_err(|e|e.to_string())?;
                if stat.cbSize==0 || stat.cbSize>64*1024*1024 {return Err("Invalid captured image size.".into());}
                completed_stream.Seek(0,STREAM_SEEK_SET,None).map_err(|e|e.to_string())?;
                let mut bytes=vec![0;stat.cbSize as usize];let mut count=0;
                completed_stream.Read(bytes.as_mut_ptr().cast(),bytes.len() as u32,Some(&mut count)).ok().map_err(|e|e.to_string())?;
                bytes.truncate(count as usize);Ok(bytes)
            })();let _=completed_sender.send(read);Ok(())
        }));
        let requested=platform.controller().CoreWebView2().and_then(|core|core.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,&stream,&handler));
        if let Err(error)=requested {let _=sender.send(Err(error.to_string()));}
    }).map_err(|e|e.to_string())?;
    tauri::async_runtime::spawn_blocking(move ||receiver.recv_timeout(std::time::Duration::from_secs(10)).map_err(|_|"Widget capture timed out. Try again.".to_string())?)
        .await.map_err(|e|e.to_string())?
}

#[tauri::command]
pub async fn widget_capture(app:tauri::AppHandle,webview:Webview,bounds:CaptureBounds,app_region:Option<AppCaptureRegion>,copy:bool) -> Result<Vec<u8>,String> {
    crate::security::authorize(&webview)?;bounds.validate()?;
    #[cfg(target_os="windows")]
    {
        let size=webview.window().inner_size().map_err(|e|e.to_string())?;
        if bounds.viewport_width*bounds.viewport_height>size.width as f64*size.height as f64*16.0 {return Err("Invalid viewport dimensions.".into());}
        let bytes=preview(&webview).await?;
        let child=if let Some(region)=app_region {region.validate(&bounds)?;
            let native_app=app.clone();let id=region.id.clone();
            let png=tauri::async_runtime::spawn_blocking(move||crate::app_panel::capture(&native_app,&id)).await.map_err(|e|e.to_string())??;
            Some((region,png))
        }else{None};
        tauri::async_runtime::spawn_blocking(move || {
            let image=compose(&bytes,&bounds,child.as_ref().map(|(region,png)|(region,png.as_slice())))?;
            if copy {let data=arboard::ImageData{width:image.width() as usize,height:image.height() as usize,bytes:std::borrow::Cow::Borrowed(image.as_raw())};
                arboard::Clipboard::new().and_then(|mut c|c.set_image(data)).map_err(|e|format!("Clipboard unavailable: {e}. Use Export PNG."))?;}
            let mut png=Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image).write_to(&mut png,image::ImageFormat::Png).map_err(|e|e.to_string())?;
            Ok(png.into_inner())
        }).await.map_err(|e|e.to_string())?
    }
    #[cfg(not(target_os="windows"))]
    {let _=(app,app_region,copy);Err("Native widget capture is available in the Windows build.".into())}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn crop_uses_viewport_ratio_and_rejects_outside_or_nonfinite_bounds() {
        let image=image::RgbaImage::from_pixel(400,200,image::Rgba([20,40,60,255]));
        let mut bytes=Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image).write_to(&mut bytes,image::ImageFormat::Png).unwrap();
        let mut b=CaptureBounds{x:20.0,y:10.0,width:80.0,height:50.0,viewport_width:200.0,viewport_height:100.0};
        let result=crop(bytes.get_ref(),&b).unwrap();assert_eq!((result.width(),result.height()),(160,100));assert_eq!(result.get_pixel(0,0).0,[20,40,60,255]);
        b.x=180.0;assert!(b.validate().is_err());b.x=f64::NAN;assert!(b.validate().is_err());b.x=0.0;b.height=-1.0;assert!(b.validate().is_err());
    }
    #[test] fn attached_app_pixels_are_composited_inside_the_widget_at_scaled_offsets(){
        fn png(color:[u8;4],w:u32,h:u32)->Vec<u8>{let mut bytes=Cursor::new(Vec::new());image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(w,h,image::Rgba(color))).write_to(&mut bytes,image::ImageFormat::Png).unwrap();bytes.into_inner()}
        let bounds=CaptureBounds{x:20.0,y:10.0,width:80.0,height:50.0,viewport_width:200.0,viewport_height:100.0};
        let mut app=AppCaptureRegion{id:"test".into(),x:25.0,y:20.0,width:60.0,height:30.0};
        let main=png([20,40,60,255],400,200);let child=png([200,100,50,255],120,60);
        let result=compose(&main,&bounds,Some((&app,&child))).unwrap();
        assert_eq!((result.width(),result.height()),(160,100));assert_eq!(result.get_pixel(0,0).0,[20,40,60,255]);assert_eq!(result.get_pixel(10,20).0,[200,100,50,255]);assert_eq!(result.get_pixel(129,79).0,[200,100,50,255]);assert_eq!(result.get_pixel(130,80).0,[20,40,60,255]);
        app.x=0.0;assert!(compose(&main,&bounds,Some((&app,&child))).is_err());
    }
}

#[tauri::command]
pub async fn widget_export(app:tauri::AppHandle,webview:Webview,png:Vec<u8>,name:String) -> Result<bool,String> {
    crate::security::authorize(&webview)?;
    if png.len()>64*1024*1024 || png.get(..8)!=Some(b"\x89PNG\r\n\x1a\n") {return Err("Invalid PNG export.".into());}
    let safe:String=name.chars().filter(|c|c.is_ascii_alphanumeric() || *c==' ' || *c=='-').take(60).collect();
    let filename=format!("Still-{}.png",if safe.trim().is_empty(){"widget"}else{safe.trim()});
    tauri::async_runtime::spawn_blocking(move ||{
        let Some(file)=app.dialog().file().set_title("Export widget screenshot").set_file_name(filename).add_filter("PNG image",&["png"]).blocking_save_file() else {return Ok(false);};
        let path=file.into_path().map_err(|e|e.to_string())?;
        std::fs::write(path,png).map_err(|e|format!("Unable to save image: {e}"))?;Ok(true)
    }).await.map_err(|e|e.to_string())?
}
